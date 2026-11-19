

const AuthAPI = window.SmartMatatuAPI;

if (!AuthAPI) {
    throw new Error(
        "Smart Matatu API module not found. Load api.js before auth.js."
    );
}


function setFormSubmitting(form, isSubmitting, buttonText = "Please wait...") {

    if (!form) {
        return;
    }

    const button = form.querySelector('button[type="submit"]');

    if (!button) {
        return;
    }

    if (isSubmitting) {

        if (!button.dataset.originalText) {
            button.dataset.originalText = button.textContent;
        }

        button.textContent = buttonText;
        button.disabled = true;

    } else {

        button.textContent =
            button.dataset.originalText || "Submit";

        button.disabled = false;
    }
}



function displayAuthError(messageElement, error) {

    console.error("Authentication error:", error);

    const message =
        error?.message ||
        "Something went wrong. Please try again.";

    AuthAPI.showMessage(messageElement, message, "error");
}


function isValidEmail(email) {

    const emailPattern =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    return emailPattern.test(email);
}

function isValidPassword(password) {

    return (
        typeof password === "string" &&
        password.length >= 8
    );
}


function isValidRole(role) {

    const allowedRoles = [
        "admin",
        "sacco_manager",
        "conductor"
    ];

    return allowedRoles.includes(role);
}

function clearAuthentication() {

    AuthAPI.removeAuthToken();

    AuthAPI.removeCurrentUser();
}

function initializeLogin() {

    const loginForm = document.getElementById("login-form");

    if (!loginForm) {
        return;
    }

    const usernameInput =
        document.getElementById("login-username");

    const passwordInput =
        document.getElementById("login-password");

    const roleInput =
        document.getElementById("login-role");

    const messageElement =
        document.getElementById("login-message");

    if (
        !usernameInput ||
        !passwordInput ||
        !roleInput
    ) {

        console.error(
            "Login form is missing its username, password or role field."
        );

        return;
    }

    loginForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        AuthAPI.clearMessage(messageElement);

        const username = usernameInput.value.trim();

        const password = passwordInput.value;

        const role = roleInput.value;

        if (!username || !password || !role) {

            AuthAPI.showMessage(
                messageElement,
                "Enter your username, password and account role.",
                "error"
            );

            return;
        }

        if (!isValidRole(role)) {

            AuthAPI.showMessage(
                messageElement,
                "Select a valid account role.",
                "error"
            );

            return;
        }

        setFormSubmitting(
            loginForm,
            true,
            "Logging in..."
        );

        try {

            const response = await AuthAPI.apiRequest(
                "/auth/login",
                {
                    method: "POST",
                    body: {
                        username,
                        password,
                        role
                    }
                }
            );

            const token =
                response?.token ||
                response?.accessToken;

            const user =
                response?.user ||
                response?.data?.user;

            if (!token) {

                throw new Error(
                    "The server did not return an authentication token."
                );
            }

            if (!user) {

                throw new Error(
                    "The server did not return account information."
                );
            }

            if (user.role !== role) {

                clearAuthentication();

                throw new Error(
                    "Your selected role does not match your account."
                );
            }

            AuthAPI.setAuthToken(token);

            AuthAPI.setCurrentUser(user);

            AuthAPI.showMessage(
                messageElement,
                "Login successful. Redirecting...",
                "success"
            );

            setTimeout(function () {

                window.location.href = "dashboard.html";

            }, 700);

        } catch (error) {

            displayAuthError(
                messageElement,
                error
            );

            setFormSubmitting(
                loginForm,
                false
            );
        }

    });
}



function initializeRegistration() {

    const registerForm =
        document.getElementById("register-form");

    if (!registerForm) {
        return;
    }

    const usernameInput =
        document.getElementById("register-username");

    const emailInput =
        document.getElementById("register-email");

    const roleInput =
        document.getElementById("register-role");

    const passwordInput =
        document.getElementById("register-password");

    const confirmPasswordInput =
        document.getElementById("register-confirm-password");

    const messageElement =
        document.getElementById("register-message");

    if (
        !usernameInput ||
        !emailInput ||
        !roleInput ||
        !passwordInput ||
        !confirmPasswordInput
    ) {

        console.error(
            "Registration form is missing one or more required fields."
        );

        return;
    }

    registerForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        AuthAPI.clearMessage(messageElement);

        const username = usernameInput.value.trim();

        const email = emailInput.value.trim();

        const role = roleInput.value;

        const password = passwordInput.value;

        const confirmPassword =
            confirmPasswordInput.value;

        if (
            !username ||
            !email ||
            !role ||
            !password ||
            !confirmPassword
        ) {

            AuthAPI.showMessage(
                messageElement,
                "Complete all registration fields.",
                "error"
            );

            return;
        }

        if (username.length < 3 || username.length > 30) {

            AuthAPI.showMessage(
                messageElement,
                "Username must contain between 3 and 30 characters.",
                "error"
            );

            return;
        }

        if (!isValidEmail(email)) {

            AuthAPI.showMessage(
                messageElement,
                "Enter a valid email address.",
                "error"
            );

            return;
        }

        if (!isValidRole(role)) {

            AuthAPI.showMessage(
                messageElement,
                "Select a valid account role.",
                "error"
            );

            return;
        }

        if (!isValidPassword(password)) {

            AuthAPI.showMessage(
                messageElement,
                "Password must contain at least 8 characters.",
                "error"
            );

            return;
        }

        if (password !== confirmPassword) {

            AuthAPI.showMessage(
                messageElement,
                "Your passwords do not match.",
                "error"
            );

            return;
        }

        setFormSubmitting(
            registerForm,
            true,
            "Creating account..."
        );

        try {

            const response = await AuthAPI.apiRequest(
                "/auth/register",
                {
                    method: "POST",
                    body: {
                        username,
                        email,
                        password,
                        role
                    }
                }
            );

            clearAuthentication();

            AuthAPI.showMessage(
                messageElement,
                response?.message ||
                "Registration submitted successfully. Your account is pending administrator approval. You can sign in after your account has been approved.",
                "success"
            );


            registerForm.reset();

        } catch (error) {

            displayAuthError(
                messageElement,
                error
            );

        } finally {

            setFormSubmitting(
                registerForm,
                false
            );
        }

    });
}


function initializeForgotPassword() {

    const forgotForm =
        document.getElementById("forgot-password-form");

    if (!forgotForm) {
        return;
    }

    const emailInput =
        document.getElementById("forgot-email");

    const messageElement =
        document.getElementById("forgot-password-message");

    if (!emailInput) {

        console.error(
            "Forgot password form is missing its email field."
        );

        return;
    }

    forgotForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        AuthAPI.clearMessage(messageElement);

        const email = emailInput.value.trim();

        if (!email || !isValidEmail(email)) {

            AuthAPI.showMessage(
                messageElement,
                "Enter a valid registered email address.",
                "error"
            );

            return;
        }

        setFormSubmitting(
            forgotForm,
            true,
            "Sending request..."
        );

        try {

            await AuthAPI.apiRequest(
                "/auth/forgot-password",
                {
                    method: "POST",
                    body: {
                        email
                    }
                }
            );

            AuthAPI.showMessage(
                messageElement,
                "If an account exists for that email, password reset instructions will be sent.",
                "success"
            );

            forgotForm.reset();

        } catch (error) {

            displayAuthError(
                messageElement,
                error
            );

        } finally {

            setFormSubmitting(
                forgotForm,
                false
            );
        }

    });
}




function initializeResetPassword() {

    const resetForm =
        document.getElementById("reset-password-form");

    if (!resetForm) {
        return;
    }

    const passwordInput =
        document.getElementById("reset-password");

    const confirmPasswordInput =
        document.getElementById("reset-confirm-password");

    const messageElement =
        document.getElementById("reset-password-message");

    if (!passwordInput || !confirmPasswordInput) {

        console.error(
            "Reset password form is missing its password fields."
        );

        return;
    }

    const urlParameters =
        new URLSearchParams(window.location.search);

    const resetToken =
        urlParameters.get("token");

    if (!resetToken) {

        AuthAPI.showMessage(
            messageElement,
            "Password reset link is invalid or missing its token.",
            "error"
        );

        const submitButton =
            resetForm.querySelector('button[type="submit"]');

        if (submitButton) {
            submitButton.disabled = true;
        }

        return;
    }

    resetForm.addEventListener("submit", async function (event) {

        event.preventDefault();

        AuthAPI.clearMessage(messageElement);

        const password = passwordInput.value;

        const confirmPassword =
            confirmPasswordInput.value;

        if (!password || !confirmPassword) {

            AuthAPI.showMessage(
                messageElement,
                "Enter and confirm your new password.",
                "error"
            );

            return;
        }

        if (!isValidPassword(password)) {

            AuthAPI.showMessage(
                messageElement,
                "Your new password must contain at least 8 characters.",
                "error"
            );

            return;
        }

        if (password !== confirmPassword) {

            AuthAPI.showMessage(
                messageElement,
                "Your passwords do not match.",
                "error"
            );

            return;
        }

        setFormSubmitting(
            resetForm,
            true,
            "Updating password..."
        );

        try {

            await AuthAPI.apiRequest(
                "/auth/reset-password",
                {
                    method: "POST",
                    body: {
                        token: resetToken,
                        password
                    }
                }
            );

            AuthAPI.showMessage(
                messageElement,
                "Your password has been updated. You can now log in.",
                "success"
            );

            resetForm.reset();

            setTimeout(function () {

                window.location.href = "login.html";

            }, 1800);

        } catch (error) {

            displayAuthError(
                messageElement,
                error
            );

        } finally {

            setFormSubmitting(
                resetForm,
                false
            );
        }

    });
}


function logoutUser() {

    clearAuthentication();

    window.location.href = "login.html";
}



document.addEventListener("DOMContentLoaded", function () {

    initializeLogin();

    initializeRegistration();

    initializeForgotPassword();

    initializeResetPassword();

    console.log(
        "Smart Matatu authentication module initialized."
    );

});


window.SmartMatatuAuth = {

    logoutUser,

    clearAuthentication,

    getCurrentUser: AuthAPI.getCurrentUser,

    getAuthToken: AuthAPI.getAuthToken

};

console.log("Smart Matatu authentication module loaded successfully.");