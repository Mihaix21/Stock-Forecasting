from prophet import Prophet
from statsmodels.tsa.statespace.sarimax import SARIMAX
import pandas as pd
from .preprocessing import get_holidays_ro


def run_prophet(df, horizon_days):
    years = range(df["ds"].dt.year.min(), df["ds"].dt.year.max() + 2)
    holidays_df = get_holidays_ro(years)

    model = Prophet(
        changepoint_prior_scale=0.3,
        seasonality_prior_scale=10,
        holidays=holidays_df,
        holidays_prior_scale=80,
        seasonality_mode="multiplicative",
        weekly_seasonality=True,
        yearly_seasonality=True

    )

    model.fit(df)
    future = model.make_future_dataframe(periods=horizon_days)
    forecast = model.predict(future)

    fc = forecast[["ds", "yhat", "yhat_lower", "yhat_upper"]].tail(horizon_days)
    fc.columns = ["ds", "yhat", "yhat_low", "yhat_high"]
    return fc.clip(lower=0)


def run_sarima(df, horizon_days):
    series = df.set_index("ds")["y"].asfreq("D").fillna(0)

    exog = None
    if "is_holiday" in df.columns:
        exog = df.set_index("ds")[["is_holiday"]].asfreq("D").fillna(0)

    model = SARIMAX(
        series,
        exog=exog,
        order=(1, 1, 1),
        seasonal_order=(0, 1, 1, 7),
        enforce_stationarity=False,
        enforce_invertibility=False
    )

    res = model.fit(disp=False)

    # Future exog (foarte important!)
    future_exog = None
    if exog is not None:
        future_dates = pd.date_range(series.index.max() + pd.Timedelta(days=1),
                                      periods=horizon_days)
        future_exog = pd.DataFrame(
            {"is_holiday": [1 if d in exog.index and exog.loc[d, "is_holiday"] == 1 else 0
                            for d in future_dates]},
            index=future_dates
        )

    fc = res.get_forecast(steps=horizon_days, exog=future_exog)

    return pd.DataFrame({
        "ds": future_dates,
        "yhat": fc.predicted_mean.clip(lower=0),
        "yhat_low": fc.conf_int().iloc[:, 0].clip(lower=0),
        "yhat_high": fc.conf_int().iloc[:, 1].clip(lower=0),
    })
