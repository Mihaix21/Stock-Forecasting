from django.urls import path
from .views import home,create_user,StockDetail,alerts_del
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView
from django.conf import settings
from django.conf.urls.static import static
from . import views
urlpatterns = [
    path('', home, name="home"),
    path("api/token/", TokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/token/refresh/", TokenRefreshView.as_view(), name="token_refresh"),
    path('api/register/', create_user, name='create_user'),
    path('api/stocks/', views.manage_stocks, name='manage_stocks'),
    path('api/stocks/<int:pk>/', StockDetail.as_view()),
    path('api/stocks/create-history/', views.create_stock_with_history, name='create-stock-history'),
    path('api/forecast/', views.forecast_view, name='forecast'),
    path('api/import-stocks/', views.import_stocks, name='import_stocks'),
    path('api/forecast/<int:stock_id>/', views.generate_and_save_plan, name='forecast_and_save'),
    path('api/alerts/', views.alerts, name='api-alerts'),
    path('api/alerts/<int:pk>/', alerts_del, name='alerts-detail'),
    path('api/alerts/run/<int:run_id>/', alerts_del, name='alerts-delete-run'),
    path('api/settings/avatar/', views.upload_avatar, name='upload_avatar'),
    path('api/settings/me/', views.settings_me, name='settings_me'),
    path('api/settings/delete-account/', views.delete_account_request, name='delete_account_request'),
    path('api/settings/password/', views.change_password, name='change_password'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)