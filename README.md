# EasyStock — Inventory Management & Demand Forecasting

EasyStock is a lightweight inventory management app that helps users track products, analyze sales history, and generate demand forecasts with automatic replenishment plans. It combines a REST backend with a simple web UI, designed to make stock decisions easier (what to reorder, when, and how much).

## What the project does

### Inventory & Sales Tracking
- Create and manage products (per user)
- Keep a daily sales history per product
- Store key inventory attributes like **current stock** and **minimum stock level**
- Import product history from Excel

### Forecasting (Smart Demand Prediction)
- Runs demand forecasting using **two approaches** and automatically picks the better one:
  - Prophet
  - SARIMA
- Uses an error metric (WAPE) to compare models and select the most accurate forecast
- Supports holiday-aware forecasting 

### Replenishment Planning
- Converts the daily forecast into a practical **reorder plan**
- Supports review periods (e.g., every 7/14 days)
- Suggests how much to order based on:
  - forecasted demand
  - current stock
  - minimum stock level

### Saved Runs & Alerts(History Plans)
- Forecast runs can be saved
- Reorder plans can be reviewed later (saved plans history)
- Past runs can be deleted/cleaned up

### User Account & Settings
- Authentication with JWT
- Profile settings (avatar,password change,account deletion)

## Technologies used
- Backend: Python, Django, Django REST Framework (JWT auth)
- Forecasting: Prophet, Statsmodels (SARIMA/SARIMAX), Pandas, NumPy
- UI: Flask + HTML templates + JavaScript (simple dashboard)

## Typical workflow
1. User logs in and adds products (or imports them from Excel).
2. User generates a forecast for a chosen horizon.
3. The system produces a reorder plan based on review cycle + minimum stock.
4. Forecast runs and plans can be saved and revisited.
