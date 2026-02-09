import numpy as np
import pandas as pd
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from rest_framework import status
from rest_framework.response import Response
from rest_framework.parsers import JSONParser, FormParser, MultiPartParser
from rest_framework.decorators import api_view, permission_classes, parser_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from django.shortcuts import render, redirect, get_object_or_404
from django.http import HttpResponse
from django.utils.dateparse import parse_date
from django.db.models import Max
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from django.utils import timezone
from django.contrib.auth.models import User
from .serializers import UserSerializer, StockWithHistorySerializer, ReorderPlanSerializer
from .models import Stock, SalesRecord, ReorderPlan, ForecastRun, UserProfile

from .forecasting.pipeline import auto_forecast_pipeline
from .forecasting.inventory import generate_order_plan, max_horizon

class CustomTokenObtainPairView(TokenObtainPairView):
    permission_classes = [AllowAny]
    parser_classes = [JSONParser]

    def post(self, request, *args, **kwargs):
        jwt_response = super().post(request, *args, **kwargs)
        if jwt_response.status_code == status.HTTP_200_OK:
            access = jwt_response.data["access"]
            refresh = jwt_response.data["refresh"]
            response = Response(status=status.HTTP_200_OK)
            response.set_cookie(
                "access_token", access,
                httponly=True, secure=False, samesite="Lax", path="/"
            )
            response.set_cookie(
                "refresh_token", refresh,
                httponly=True, secure=False, samesite="Lax",
                path="/api/token/refresh/"
            )
            return response
        return jwt_response


class CustomTokenRefreshView(TokenRefreshView):
    permission_classes = [AllowAny]

    def post(self, request, *args, **kwargs):
        jwt_response = super().post(request, *args, **kwargs)
        if jwt_response.status_code == status.HTTP_200_OK:
            access = jwt_response.data["access"]
            response = Response(status=status.HTTP_200_OK)
            response.set_cookie("access_token", access, httponly=True, secure=False, samesite="Lax", path="/")
            return response
        return jwt_response


def home(request):
    return HttpResponse("<h1>Bine ai venit la EasyStock!</h1><p>Autentifică-te pentru a continua.</p>")


@api_view(['POST'])
@parser_classes([JSONParser])
@permission_classes([AllowAny])
def create_user(request):
    if request.method == 'POST':
        serializer = UserSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def manage_stocks(request):
    if request.method == 'GET':
        stocks = Stock.objects.filter(user=request.user).order_by('id')
        serializer = StockWithHistorySerializer(stocks, many=True)
        return Response(serializer.data)

    serializer = StockWithHistorySerializer(data=request.data, context={'request': request})
    serializer.is_valid(raise_exception=True)
    stock = serializer.save(user=request.user)
    return Response(StockWithHistorySerializer(stock).data, status=status.HTTP_201_CREATED)


class StockDetail(RetrieveUpdateDestroyAPIView):
    queryset = Stock.objects.all()
    serializer_class = StockWithHistorySerializer
    permission_classes = [IsAuthenticated]
    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_queryset(self):
        return Stock.objects.filter(user=self.request.user).order_by('id')


@api_view(['DELETE'])
@permission_classes([AllowAny])
def product_detail(request, pk):
    stock = get_object_or_404(Stock, pk=pk, user=request.user)
    stock.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([AllowAny])
def create_stock_with_history(request):
    serializer = StockWithHistorySerializer(data=request.data)
    if serializer.is_valid():
        stock = serializer.save()
        return Response(StockWithHistorySerializer(stock).data, status=status.HTTP_201_CREATED)
    return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


@api_view(['GET'])
@permission_classes([AllowAny])
def forecast_view(request):
    pid = request.query_params.get('product_id')
    if pid is None:
        return Response({"detail": "Trebuie să trimiți product_id."}, status=400)

    try:
        stock = Stock.objects.get(pk=pid)
    except Stock.DoesNotExist:
        return Response({"detail": "Produsul nu a fost găsit."}, status=404)

    months = int(request.query_params.get('months', 3))
    review_days = int(request.query_params.get('review_days', 14))

    qs = stock.history.all().order_by('date')
    if not qs.exists():
        return Response({"detail": "Nu există istoric pentru acest produs."}, status=400)

    df = pd.DataFrame.from_records(qs.values('date', 'daily_sales', 'stock_quantity'))
    df = df.rename(columns={'date': 'ds', 'daily_sales': 'y', 'stock_quantity': 'stock_quantity'})

    years_data = (df['ds'].max().year - df['ds'].min().year + (df['ds'].max().month - df['ds'].min().month) / 12)
    allowed = max_horizon(years_data)
    horizon_months = min(months, allowed)
    horizon_days = int(horizon_months * 30.5)

    if horizon_days <= 0:
        return Response({"detail": "Istoric insuficient pentru forecast."}, status=400)

    fc_df, wape, model_name = auto_forecast_pipeline(df, horizon_days=horizon_days)

    if fc_df is None:
        return Response({"detail": "Eroare la generarea prognozei (date insuficiente/incorecte)."}, status=400)


    initial_stock = qs.last().stock_quantity
    min_stock = stock.min_stock_level

    plan_df = generate_order_plan(fc_df, initial_stock, min_stock, review_period_days=review_days)

    return Response({
        "model": model_name,
        "horizon_months": horizon_months,
        "accuracy_wape": f"{wape:.2%}",
        "forecast": fc_df.rename(columns={"yhat": "yhat"}).to_dict(orient="records"),
        "plan": plan_df.to_dict(orient="records")
    })


@api_view(['POST'])
@permission_classes([AllowAny])
def generate_and_save_plan(request, stock_id):
    stock = get_object_or_404(Stock, pk=stock_id, user=request.user)

    qs_hist = stock.history.all().values('date', 'daily_sales', 'stock_quantity','is_holiday')
    df = pd.DataFrame(qs_hist).rename(columns={'date': 'ds', 'daily_sales': 'y'})
    df['ds'] = pd.to_datetime(df['ds'])

    if df.empty:
        return Response({'error': 'Nu există istoric.'}, status=400)

    years = (df['ds'].max() - df['ds'].min()).days / 365.0
    allowed = max_horizon(years)
    months = min(int(request.data.get('months', allowed)), allowed)
    horizon_days = int(months * 30.5)
    review_days = int(request.data.get('review_days', 14))

    fc_df, wape, model_name = auto_forecast_pipeline(df, horizon_days=horizon_days)

    if fc_df is None:
        return Response({'error': 'Prognoza a eșuat. Verifică datele.'}, status=400)

    last_rec = stock.history.order_by('-date').first()
    initial_stock = last_rec.stock_quantity if last_rec else 0
    min_stock = stock.min_stock_level

    plan_df = generate_order_plan(
        fc_df,
        current_stock=initial_stock,
        min_stock_level=min_stock,
        review_period_days=review_days
    )

    run = ForecastRun.objects.create(
        stock=stock,
        months=months,
        review_days=review_days
    )

    objs = []
    for row in plan_df.to_dict('records'):
        objs.append(ReorderPlan(
            run=run,
            review_date=row['review_date'],
            stock_before=row['stock_before'],
            demand_next=row['demand_next'],
            order_qty=row['order_qty'],
            stock_name=stock.stock_name
        ))
    ReorderPlan.objects.bulk_create(objs)

    total_order = plan_df["order_qty"].sum() if not plan_df.empty else 0.0
    accuracy_pct = round(max(0.0, (1 - float(wape)) * 100), 1)

    return Response({
        "plan": plan_df.to_dict(orient="records"),
        "summary": {
            "model": model_name,
            "accuracy_pct": accuracy_pct,
            "min_stock_level_used": min_stock,
            "total_order_qty": round(total_order, 2),
        }
    }, status=status.HTTP_201_CREATED)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def import_stocks(request):
    name = request.data.get('stock_name')
    f = request.FILES.get('file')
    if not name or not f:
        return Response({'error': 'Lipsește stock_name sau fișier'}, status=400)

    try:
        df = pd.read_excel(f, engine='openpyxl')
    except Exception as e:
        return Response({'error': f'Nu am putut citi Excel: {e}'}, status=400)

    required = {'ds', 'daily_sales', 'current_stock_quantity', 'min_stock_level'}
    if not required.issubset(set(df.columns)):
        return Response(
            {'error': f'Coloane lipsă. Trebuie: {required}'},
            status=400
        )

    min_lvl = int(df['min_stock_level'].max())
    stock = Stock.objects.create(
        user=request.user,
        stock_name=name,
        min_stock_level=min_lvl
    )

    records = []
    for _, row in df.iterrows():
        ds = row['ds']
        if hasattr(ds, 'date'):
            ds = ds.date()
        else:
            ds = parse_date(str(ds))

        records.append(SalesRecord(
            stock=stock,
            date=ds,
            daily_sales=int(row['daily_sales']),
            stock_quantity=int(row['current_stock_quantity'])
        ))

    SalesRecord.objects.bulk_create(records)
    return Response({'message': 'Import reușit!'}, status=status.HTTP_201_CREATED)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def alerts(request):
    plans = (ReorderPlan.objects
             .filter(run__stock__user=request.user)
             .order_by('-created_at'))
    serializer = ReorderPlanSerializer(plans, many=True)
    return Response(serializer.data)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def alerts_del(request, run_id):
    run = get_object_or_404(ForecastRun, pk=run_id, stock__user=request.user)
    ReorderPlan.objects.filter(run=run).delete()
    run.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
@parser_classes([MultiPartParser, FormParser])
def upload_avatar(request):
    f = request.FILES.get('avatar')
    if not f: return Response({'error': 'No file.'}, status=400)
    profile, _ = UserProfile.objects.get_or_create(user=request.user)
    if profile.avatar: profile.avatar.delete(save=False)
    profile.avatar = f
    profile.save()
    return Response({'avatar_url': request.build_absolute_uri(profile.avatar.url)})


@api_view(['GET', 'PATCH'])
@permission_classes([IsAuthenticated])
def settings_me(request):
    if request.method == 'GET':
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        avatar_url = request.build_absolute_uri(profile.avatar.url) if profile.avatar else None

        is_scheduled = False
        days_left = None
        if profile.deletion_scheduled_at:
            is_scheduled = True
            delta = (profile.deletion_scheduled_at + timezone.timedelta(days=28)) - timezone.now()
            days_left = max(0, delta.days)

        return Response({
            'username': request.user.username,
            'email': request.user.email,
            'avatar_url': avatar_url,
            'full_name': f"{request.user.first_name} {request.user.last_name}".strip(),
            'deletion_pending': is_scheduled,
            'days_left': days_left
        })

    elif request.method == 'PATCH':
        user = request.user
        data = request.data

        if 'username' in data and data['username']:
            if User.objects.filter(username=data['username']).exclude(pk=user.pk).exists():
                return Response({'error': 'Username already taken.'}, status=400)
            user.username = data['username']

        if 'email' in data and data['email']:
            if User.objects.filter(email=data['email']).exclude(pk=user.pk).exists():
                return Response({'error': 'Email already used.'}, status=400)
            user.email = data['email']

        if 'full_name' in data:
            full_name = data['full_name'].strip()
            if full_name:
                parts = full_name.split(' ', 1)
                user.first_name = parts[0]
                user.last_name = parts[1] if len(parts) > 1 else ''
            else:
                user.first_name = ''
                user.last_name = ''

        user.save()
        return Response({'message': 'Profile updated successfully.'}, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def change_password(request):
    user = request.user
    data = request.data

    old_pass = data.get('current_password')
    new_pass = data.get('new_password')

    if not user.check_password(old_pass):
        return Response({'error': 'Current password is incorrect.'}, status=400)

    user.set_password(new_pass)
    user.save()

    return Response({'message': 'Password updated successfully.'}, status=200)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def delete_account_request(request):
    profile, _ = UserProfile.objects.get_or_create(user=request.user)

    profile.deletion_scheduled_at = timezone.now()
    profile.save()

    return Response({
        "message": "Contul a fost programat pentru ștergere.",
        "days_until_deletion": 28
    }, status=status.HTTP_200_OK)