from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Stock,SalesRecord,ReorderPlan,ForecastRun
from rest_framework.fields import CurrentUserDefault, HiddenField

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'password', 'first_name', 'last_name']
        extra_kwargs = {
            'password': {'write_only': True}
        }

    def create(self, validated_data):
        first_name = validated_data.get('first_name', '')
        last_name = validated_data.get('last_name', '')
        user = User.objects.create_user(
            username=validated_data['username'],
            email=validated_data['email'],
            first_name=first_name,
            last_name=last_name,
            password=validated_data['password']
        )
        return user


class SalesRecordSerializer(serializers.ModelSerializer):
    date = serializers.DateField(format="%Y-%m-%d")

    class Meta:
        model = SalesRecord
        fields = ('date', 'daily_sales', 'stock_quantity')


class StockWithHistorySerializer(serializers.ModelSerializer):
    daily_sales_quantity   = serializers.SerializerMethodField()
    current_stock_quantity = serializers.SerializerMethodField()
    history                = SalesRecordSerializer(many=True, required=False)
    user = HiddenField(default=CurrentUserDefault())
    class Meta:
        model  = Stock
        fields = (
            'id',
            'user',
            'stock_name',
            'min_stock_level',
            'daily_sales_quantity',
            'current_stock_quantity',
            'history',
            'is_active',
        )
        read_only_fields = ('id', 'user')

    def get_daily_sales_quantity(self, obj):
        last = obj.history.order_by('-date').first()
        return last.daily_sales if last else 0

    def get_current_stock_quantity(self, obj):
        last = obj.history.order_by('-date').first()
        return last.stock_quantity if last else 0

    def create(self, validated_data):
        history_data = validated_data.pop('history', [])
        stock = Stock.objects.create(**validated_data)

        records = [
            SalesRecord(
                stock=stock,
                date=rec['date'],
                daily_sales=rec['daily_sales'],
                stock_quantity=rec['stock_quantity']
            ) for rec in history_data
        ]
        SalesRecord.objects.bulk_create(records)
        return stock

    def update(self, instance, validated_data):
        history_data = validated_data.pop('history', None)

        for attr, val in validated_data.items():
            setattr(instance, attr, val)
        instance.save()

        if history_data is not None:
            instance.history.all().delete()
            new = [
                SalesRecord(
                    stock=instance,
                    date=rec['date'],
                    daily_sales=rec['daily_sales'],
                    stock_quantity=rec['stock_quantity']
                ) for rec in history_data
            ]
            SalesRecord.objects.bulk_create(new)

        return instance

class ReorderPlanSerializer(serializers.ModelSerializer):
    stock_name = serializers.CharField(
        source='run.stock.stock_name',
        read_only=True
    )
    months = serializers.IntegerField(source='run.months', read_only=True)
    run_id = serializers.IntegerField(source='run.id', read_only=True)

    class Meta:
        model = ReorderPlan
        fields = (
            'id',
            'stock_name',
            'run_id',
            'months',
            'review_date',
            'stock_before',
            'demand_next',
            'order_qty',
            'created_at',
            )
        read_only_fields = ('id', 'created_at')


class ForecastRunSerializer(serializers.ModelSerializer):
    user = HiddenField(default=CurrentUserDefault())
    class Meta:
        model = ForecastRun
        fields = ('id','run_at','months','review_days','user')
        read_only_fields = ('id', 'user')