from unittest.mock import DEFAULT

from django.db import models

# Create your models here.
from django.db import models
from django.conf import settings
from openpyxl.chart.trendline import Trendline
from django.contrib.auth.models import User
import os,time
from django.utils.text import slugify

class Stock(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='stocks',
        null=True,
        blank=True
    )
    stock_name             = models.CharField(max_length=50)
    min_stock_level        = models.PositiveIntegerField()
    created_at =            models.DateTimeField(auto_now_add=True)
    updated_at             = models.DateTimeField(auto_now=True)
    is_active              = models.BooleanField(default=True)
    def __str__(self):
        return self.stock_name

class SalesRecord(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='forecast_runs',
        null=True,
        blank=True
    )
    stock           = models.ForeignKey(
                        Stock,
                        on_delete=models.CASCADE,
                        related_name='history'
                      )
    date            = models.DateField()
    daily_sales     = models.PositiveIntegerField()
    stock_quantity  = models.PositiveIntegerField()
    is_holiday = models.BooleanField(default=False)
    class Meta:
        unique_together = ('stock','date')
        ordering        = ['date']


class ForecastRun(models.Model):
    stock = models.ForeignKey(Stock, on_delete=models.CASCADE, related_name='forecast_runs')
    run_at = models.DateTimeField(auto_now_add=True)
    months = models.IntegerField()
    review_days = models.IntegerField()

class ReorderPlan(models.Model):
    run = models.ForeignKey(ForecastRun, on_delete=models.CASCADE, related_name='plans',null = True, blank = True)
    stock_name = models.CharField(
        max_length=50,
        default='',
        blank=True,
    )
    review_date   = models.DateField()
    stock_before  = models.FloatField()
    demand_next   = models.FloatField()
    order_qty     = models.FloatField()
    created_at    = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['review_date']
        verbose_name = "Plan de reaprovizionare"
        verbose_name_plural = "Planuri de reaprovizionare"

    def __str__(self):
        return f"{self.stock} @ {self.review_date}: order {self.order_qty}"

def avatar_upload_to(instance, filename):
    name, ext = os.path.splitext(filename)
    safe = slugify(name) or 'avatar'
    ts = int(time.time())
    return f"avatars/u{instance.user_id}/{ts}_{safe}{ext.lower()}"

class UserProfile(models.Model):
    user   = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='profile',
        unique=True
    )
    avatar = models.ImageField(upload_to=avatar_upload_to, blank=True, null=True)
    updated_at = models.DateTimeField(auto_now=True)
    deletion_scheduled_at = models.DateTimeField(null=True, blank=True, default=None)
    def __str__(self):
        return f"Profile({self.user})"
