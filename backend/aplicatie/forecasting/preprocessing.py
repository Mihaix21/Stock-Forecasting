import numpy as np
import pandas as pd
import holidays


def get_holidays_ro(years):
    ro = holidays.country_holidays("RO", years=list(years))
    return pd.DataFrame({
        "ds": pd.to_datetime(list(ro.keys())),
        "holiday": list(ro.values()),
        "lower_window": 0,
        "upper_window": 1
    })


def prep_data(df, date_col="ds", sales_col="y", stock_col="stock_quantity"):
    cols_map = {date_col: "ds", sales_col: "y"}
    if stock_col in df.columns:
        cols_map[stock_col] = "stock"

    df = df.rename(columns=cols_map).copy()
    df["ds"] = pd.to_datetime(df["ds"])
    df = df.groupby("ds", as_index=False).sum()

    idx = pd.date_range(df["ds"].min(), df["ds"].max(), freq="D")
    df = df.set_index("ds").reindex(idx).reset_index().rename(columns={"index": "ds"})

    if "stock" in df.columns:
        df.loc[df["stock"] <= 0, "y"] = np.nan

    df["y"] = df["y"].fillna(
        df["y"].rolling(7, min_periods=1, center=True).median()
    )
    df["y"] = df["y"].fillna(0).clip(lower=0)

    cols = ["ds", "y"]
    if "is_holiday" in df.columns:
        cols.append("is_holiday")

    return df[cols]
