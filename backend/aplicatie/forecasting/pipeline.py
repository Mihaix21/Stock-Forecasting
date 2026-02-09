from .preprocessing import prep_data
from .models import run_prophet, run_sarima


def wape(y_true, y_pred):
    denom = y_true.sum()
    return ((y_true - y_pred).abs().sum() / denom) if denom > 0 else 0


def auto_forecast_pipeline(df_raw, horizon_days):
    df = prep_data(df_raw)

    if len(df) < 14:
        return None, 0, "Insufficient Data"

    fc_p, fc_s = None, None
    wape_p, wape_s = 1e9, 1e9

    try:
        fc_p = run_prophet(df, horizon_days)
        wape_p = wape(df["y"].tail(14), fc_p["yhat"].head(14))
    except:
        pass

    try:
        fc_s = run_sarima(df, horizon_days)
        wape_s = wape(df["y"].tail(14), fc_s["yhat"].head(14))
    except:
        pass

    if wape_s < wape_p:
        return fc_s, wape_s, "SARIMA"

    return fc_p, wape_p, "Prophet"
