from flask import Flask, request, jsonify, render_template, redirect, make_response, flash
import requests
from functools import wraps
import io

app = Flask(__name__)
app.secret_key = 'cheie_super_secreta'


TOKEN_URL = "http://127.0.0.1:8000/api/token/"
STOCKS_URL = "http://127.0.0.1:8000/api/stocks/"
FORECAST_URL = "http://127.0.0.1:8000/api/forecast/"
ALERTS_URL = "http://127.0.0.1:8000/api/alerts/"
SETTINGS_URL = "http://127.0.0.1:8000/api/settings/"

def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        token = request.cookies.get("access_token")
        if not token:
            flash("Trebuie să te autentifici!")
            return redirect("/login_page")
        return f(*args, **kwargs)

    return decorated


def _auth_headers_from_cookie():
    token = request.cookies.get("access_token")
    return {"Authorization": f"Bearer {token}"} if token else {}


def _make_response_from_requests(r, new_access=None):
    resp = make_response(r.content, r.status_code)
    resp.headers["Content-Type"] = r.headers.get("Content-Type", "application/json")
    if new_access:
        resp.set_cookie(
            "access_token", new_access,
            httponly=True, secure=False, samesite="Lax", path="/"
        )
    return resp


def _refresh_access_token():
    refresh = request.cookies.get("refresh_token")
    if not refresh:
        return None
    try:
        r = requests.post("http://127.0.0.1:8000/api/token/refresh/",
                          json={"refresh": refresh}, timeout=5)
        if r.status_code != 200:
            return None
        return r.json().get("access")
    except requests.exceptions.RequestException:
        return None


def _forward_with_refresh(method, url, retry_on_401=True, **kwargs):
    headers = {**_auth_headers_from_cookie(), **kwargs.pop("headers", {})}
    r = requests.request(method, url, headers=headers, **kwargs)
    if r.status_code != 401 or not retry_on_401:
        return _make_response_from_requests(r)

    new_access = _refresh_access_token()
    if not new_access:
        return _make_response_from_requests(r)

    headers["Authorization"] = f"Bearer {new_access}"
    r2 = requests.request(method, url, headers=headers, **kwargs)
    return _make_response_from_requests(r2, new_access=new_access)


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/login_page")
def login_page():
    return render_template("login.html")


@app.route("/register_page")
def register_page():
    return render_template("register.html")


@app.route("/register", methods=["POST"])
def register():
    data = request.get_json()
    if not data or any(k not in data for k in ("username", "email", "password")):
        return jsonify({"error": "Lipsește username, email sau password"}), 400
    try:
        resp = requests.post("http://127.0.0.1:8000/api/register/", json=data)
        if resp.status_code == 201:
            return jsonify({"message": "User creat cu succes!"}), 201
        return jsonify({"error": resp.json()}), resp.status_code
    except requests.exceptions.RequestException as e:
        return jsonify({"error": "Eroare server Django: " + str(e)}), 500


@app.route("/login", methods=["POST"])
def login():
    data = request.get_json()
    if not data or any(k not in data for k in ("username", "password")):
        return jsonify({"error": "Lipsește username sau password"}), 400

    try:
        resp = requests.post(TOKEN_URL, json=data, timeout=5)
        resp.raise_for_status()
        tokens = resp.json()
        jwt_access = tokens.get("access")
        jwt_refresh = tokens.get("refresh")

        response = make_response(redirect("/dashboard"))
        response.set_cookie(
            "access_token", jwt_access,
            httponly=True, secure=False, samesite="Lax", path="/"
        )
        if jwt_refresh:
            response.set_cookie(
                "refresh_token", jwt_refresh,
                httponly=True, secure=False, samesite="Lax", path="/"
            )
        return response
    except requests.exceptions.RequestException as e:
        return jsonify({"error": " Login failed! Username and/or password is wrong. "}), 400


@app.route("/dashboard")
@login_required
def dashboard():
    headers = _auth_headers_from_cookie()
    try:
        resp = requests.get(STOCKS_URL, headers=headers, timeout=5)
        if resp.status_code == 401:
            flash("Token invalid sau expirat!")
            return redirect("/login_page")
        stocks = resp.json()
        return render_template("dashboard.html", stocks=stocks)
    except requests.exceptions.RequestException:
        flash("Eroare de conexiune cu serverul Django!")
        return redirect("/login_page")


@app.route("/dashboard/modifyStocks", methods=["GET"])
@login_required
def modify_stocks():
    return render_template("modify_stocks.html")


@app.route("/dashboard/viewProducts")
@login_required
def view_products():
    return render_template("viewProducts.html")


@app.route("/dashboard/forecast", methods=["GET", "POST"])
@login_required
def forecast():
    return render_template("forecast.html")


@app.route("/dashboard/alerts")
@login_required
def alerts_page():
    return render_template("alerts.html")


@app.route("/dashboard/settings")
@login_required
def settings_page():
    return render_template("settings.html")


# --- PROXY API ENDPOINTS ---

@app.route("/api/token/refresh/", methods=["POST"])
@login_required
def proxy_refresh():
    new_access = _refresh_access_token()
    if not new_access:
        return jsonify({"error": "Refresh failed"}), 401
    resp = jsonify({"ok": True})
    resp.set_cookie("access_token", new_access,
                    httponly=True, secure=False, samesite="Lax", path="/")
    return resp


@app.route("/api/stocks/", methods=["GET", "POST"])
@app.route("/api/manage_stocks", methods=["GET"])
@login_required
def proxy_stocks():
    if request.method == "GET":
        return _forward_with_refresh("GET", STOCKS_URL, timeout=10)

    payload = request.get_json(silent=True) or {}
    return _forward_with_refresh("POST", STOCKS_URL, json=payload, timeout=15)


@app.route("/api/stocks/<int:pk>/", methods=["GET", "PATCH", "DELETE"])
@login_required
def proxy_stock_detail(pk):
    url = f"http://127.0.0.1:8000/api/stocks/{pk}/"
    if request.method == "GET":
        return _forward_with_refresh("GET", url, timeout=10)
    if request.method == "PATCH":
        payload = request.get_json(silent=True) or {}
        return _forward_with_refresh("PATCH", url, json=payload, timeout=15)
    return _forward_with_refresh("DELETE", url, timeout=10)


@app.route("/api/forecast/<int:stock_id>/", methods=["POST"])
@login_required
def proxy_forecast_save(stock_id):
    url = f"http://127.0.0.1:8000/api/forecast/{stock_id}/"
    payload = request.get_json(silent=True) or {}
    return _forward_with_refresh("POST", url, json=payload, timeout=30)


@app.route("/api/import-stocks/", methods=["POST"])
@login_required
def proxy_import_stocks():
    url = "http://127.0.0.1:8000/api/import-stocks/"
    name = request.form.get("stock_name", "")
    f = request.files.get("file")

    data = {"stock_name": name}
    files = None
    file_bytes = None
    filename = mimetype = None

    if f:
        file_bytes = f.read()
        filename = f.filename
        mimetype = f.mimetype
        files = {"file": (filename, io.BytesIO(file_bytes), mimetype)}

    headers = _auth_headers_from_cookie()
    r = requests.post(url, headers=headers, data=data, files=files, timeout=30)
    if r.status_code != 401:
        return _make_response_from_requests(r)

    new_access = _refresh_access_token()
    if not new_access:
        return _make_response_from_requests(r)

    headers["Authorization"] = f"Bearer {new_access}"
    files_retry = None
    if file_bytes is not None:
        files_retry = {"file": (filename, io.BytesIO(file_bytes), mimetype)}

    r2 = requests.post(url, headers=headers, data=data, files=files_retry, timeout=30)
    return _make_response_from_requests(r2, new_access=new_access)


@app.route("/api/alerts/", methods=["GET"])
@login_required
def proxy_alerts():
    return _forward_with_refresh("GET", ALERTS_URL, timeout=10)


@app.route("/api/alerts/run/<int:run_id>/", methods=["DELETE"])
@login_required
def proxy_alerts_del(run_id):
    url = f"http://127.0.0.1:8000/api/alerts/run/{run_id}/"
    return _forward_with_refresh("DELETE", url, timeout=10)



@app.route("/api/settings/avatar", methods=["POST"])
@app.route("/api/settings/avatar/", methods=["POST"])  # Alias cu slash
@login_required
def proxy_settings_avatar():
    url = "http://127.0.0.1:8000/api/settings/avatar/"
    f = request.files.get("avatar")
    files = None
    if f:
        files = {"avatar": (f.filename, f.stream, f.mimetype)}
    return _forward_with_refresh("POST", url, files=files, timeout=20)


@app.route("/api/settings/me", methods=["GET", "PATCH"])
@app.route("/api/settings/me/", methods=["GET", "PATCH"])
@login_required
def proxy_settings_me():
    url = "http://127.0.0.1:8000/api/settings/me/"

    if request.method == "GET":
        return _forward_with_refresh("GET", url, timeout=10)

    payload = request.get_json(silent=True) or {}
    return _forward_with_refresh("PATCH", url, json=payload, timeout=10)

@app.route("/api/settings/password", methods=["POST"])
@app.route("/api/settings/password/", methods=["POST"])
@login_required
def proxy_settings_password():
    url = "http://127.0.0.1:8000/api/settings/password/"
    payload = request.get_json(silent=True) or {}
    return _forward_with_refresh("POST", url, json=payload, timeout=10)


@app.route("/api/settings/delete-account", methods=["POST"])
@app.route("/api/settings/delete-account/", methods=["POST"])  # Alias cu slash
@login_required
def proxy_delete_account():
    url = "http://127.0.0.1:8000/api/settings/delete-account/"

    return _forward_with_refresh("POST", url, timeout=10)


@app.route("/logout", methods=["GET"], strict_slashes=False, endpoint="logout")
@app.route("/logout/", methods=["GET"], strict_slashes=False)
def do_logout():
    resp = make_response(redirect("/login_page"))
    resp.delete_cookie("access_token", path="/")
    resp.delete_cookie("refresh_token", path="/")
    resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
    resp.headers["Pragma"] = "no-cache"
    return resp


@app.after_request
def add_nocache_headers(resp):
    p = (request.path or "")
    if p.startswith("/dashboard") or p.startswith("/api/"):
        resp.headers["Cache-Control"] = "no-store, no-cache, must-revalidate, max-age=0"
        resp.headers["Pragma"] = "no-cache"
    return resp


if __name__ == "__main__":
    app.run(debug=True)