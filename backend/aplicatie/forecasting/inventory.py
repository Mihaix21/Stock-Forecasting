import pandas as pd
def max_horizon(years):
    if years < 1: return 0
    if years < 2: return 3
    if years < 3: return 6
    if years < 4: return 9
    return 12


def generate_order_plan(forecast_df, current_stock, min_stock_level, review_period_days=14):
    fc = forecast_df.copy()
    fc["period_id"] = ((fc["ds"] - fc["ds"].min()).dt.days // review_period_days)

    plan = fc.groupby("period_id").agg(
        period_start=("ds", "min"),
        total_demand=("yhat", "sum")
    ).reset_index()

    rows = []
    stock = float(current_stock)

    for _, row in plan.iterrows():
        required = row["total_demand"] + min_stock_level
        order = max(0, required - stock)
        end_stock = stock + order - row["total_demand"]

        rows.append({
            "review_date": row["period_start"].date(),
            "stock_before": round(stock, 1),
            "demand_next": round(row["total_demand"], 1),
            "order_qty": round(order, 1),
            "end_stock_est": round(end_stock, 1)
        })
        stock = end_stock

    return pd.DataFrame(rows)