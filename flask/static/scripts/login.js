document.addEventListener("DOMContentLoaded", () => {
    const loginForm = document.getElementById("loginForm");
    const errorDiv = document.getElementById("error-msg");
    const submitBtn = document.getElementById("submitBtn");

    if (!loginForm) return;

    loginForm.addEventListener("submit", async e => {
        e.preventDefault();

        errorDiv.style.display = "none";
        errorDiv.textContent = "";
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = "Logging in...";

        const username = document.getElementById("username").value.trim();
        const password = document.getElementById("password").value;

        try {
            const response = await fetch("/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ username, password })
            });

            if (!response.ok) {
                const err = await response.json().catch(() => ({}));
                const msg = err.error || err.details || "Invalid credentials. Please try again.";
                throw new Error(msg);
            }

            window.location.href = "/dashboard";

        } catch (err) {
            console.error("Login failed:", err);

            errorDiv.textContent = err.message;
            errorDiv.style.display = "block";

            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
});