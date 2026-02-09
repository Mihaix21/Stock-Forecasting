from django import forms
from .models import Stock

class StockForm(forms.ModelForm):
    class Meta:
        model = Stock
        fields = ['stock_name', 'daily_sales_quantity', 'current_stock_quantity', 'min_stock_level']

