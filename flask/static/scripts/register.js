document.addEventListener("DOMContentLoaded", function () {
    const registerForm = document.getElementById("registerForm");
    const errorDiv = document.getElementById("error-msg");
    const submitBtn = document.getElementById("submitBtn");

    if (!registerForm) {
        console.error("Formularul de înregistrare nu a fost găsit!");
        return;
    }

    registerForm.addEventListener("submit", async function (e) {
        e.preventDefault();
        errorDiv.style.display = "none";
        errorDiv.textContent = "";
        submitBtn.disabled = true;
        const originalBtnText = submitBtn.textContent;
        submitBtn.textContent = "Signing Up...";

        const username = document.getElementById("username").value.trim();
        const email = document.getElementById("email").value.trim();
        const password = document.getElementById("password").value;
        const confirm_password = document.getElementById("confirm_password").value;

        if (password !== confirm_password) {
            showError("Passwords do not match!");
            resetButton();
            return;
        }

        if (password.length < 6) {
            showError("Password must be at least 6 characters long.");
            resetButton();
            return;
        }

        try {
            const response = await fetch("http://127.0.0.1:8000/api/register/", {
                method: "POST",
                credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ username, email, password })
            });

            const result = await response.json();

            if (response.ok) {
                window.location.href = "/login_page";
            } else {
                throw new Error(result.error || "Registration failed. Please try again.");
            }

        } catch (err) {
            console.error("Registration error:", err);
            showError(err.message);
            resetButton();
        }

        function showError(msg) {
            errorDiv.textContent = msg;
            errorDiv.style.display = "flex";
        }

        function resetButton() {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });
});