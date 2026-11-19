"use strict";


(function () {
    const API = window.SmartMatatuAPI;

    if (!API) {
        console.error("SmartMatatuAPI is unavailable.");
        return;
    }

    const elements = {
        avatar: document.getElementById("profile-avatar"),
        displayName: document.getElementById("profile-display-name"),
        emailDisplay: document.getElementById("profile-email-display"),
        status: document.getElementById("profile-status"),

        username: document.getElementById("profile-username"),
        role: document.getElementById("profile-role"),
        userId: document.getElementById("profile-user-id"),
        createdAt: document.getElementById("profile-created-at"),

        profileForm: document.getElementById("profile-form"),
        editUsername: document.getElementById("profile-edit-username"),
        editEmail: document.getElementById("profile-edit-email"),
        saveProfileButton: document.getElementById("save-profile-button"),

        passwordForm: document.getElementById("change-password-form"),
        currentPassword: document.getElementById("current-password"),
        newPassword: document.getElementById("new-password"),
        confirmPassword: document.getElementById("confirm-new-password"),
        changePasswordButton: document.getElementById("change-password-button"),

        message: document.getElementById("profile-message")
    };

    let currentProfile = null;



    function getValue(object, keys, fallback = "") {
        if (!object || typeof object !== "object") {
            return fallback;
        }

        for (const key of keys) {
            if (
                object[key] !== undefined &&
                object[key] !== null &&
                object[key] !== ""
            ) {
                return object[key];
            }
        }

        return fallback;
    }

    function getProfileFromResponse(response) {
        if (!response || typeof response !== "object") {
            return null;
        }

        if (response.user && typeof response.user === "object") {
            return response.user;
        }

        if (response.profile && typeof response.profile === "object") {
            return response.profile;
        }

        if (response.data?.user && typeof response.data.user === "object") {
            return response.data.user;
        }

        if (response.data?.profile && typeof response.data.profile === "object") {
            return response.data.profile;
        }

        return response;
    }

    function getUsername(profile) {
        return String(
            getValue(profile, ["username", "name"], "User")
        );
    }

    function getEmail(profile) {
        return String(
            getValue(profile, ["email", "email_address"], "Not provided")
        );
    }

    function getRole(profile) {
        return String(
            getValue(profile, ["role", "user_role"], "user")
        );
    }

    function getUserId(profile) {
        return getValue(profile, ["id", "user_id"], "Not available");
    }

    function getCreatedAt(profile) {
        return getValue(
            profile,
            ["created_at", "createdAt", "date_created"],
            null
        );
    }

    function getStatus(profile) {
        const status = getValue(
            profile,
            ["status", "account_status"],
            null
        );

        if (status !== null) {
            return String(status).toLowerCase();
        }

        const active = getValue(
            profile,
            ["is_active", "active"],
            true
        );

        return active === false || active === 0
            ? "suspended"
            : "active";
    }

    function formatDate(value) {
        if (!value) {
            return "Not available";
        }

        const date = new Date(value);

        if (Number.isNaN(date.getTime())) {
            return String(value);
        }

        return date.toLocaleDateString("en-KE", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });
    }

    
    function showMessage(message, type = "info") {
        if (!elements.message) {
            return;
        }

        elements.message.textContent = message;
        elements.message.className = "message-box";

        if (type === "error") {
            elements.message.classList.add("error");
        } else if (type === "success") {
            elements.message.classList.add("success");
        } else {
            elements.message.classList.add("info");
        }
    }

    function clearMessage() {
        if (!elements.message) {
            return;
        }

        elements.message.textContent = "";
        elements.message.className = "message-box";
    }

    
    function setButtonLoading(button, loading, loadingText, normalText) {
        if (!button) {
            return;
        }

        button.disabled = loading;
        button.textContent = loading ? loadingText : normalText;
    }

    
    function displayProfile(profile) {
        if (!profile) {
            return;
        }

        const username = getUsername(profile);
        const email = getEmail(profile);
        const role = getRole(profile);
        const userId = getUserId(profile);
        const createdAt = getCreatedAt(profile);
        const status = getStatus(profile);

        if (elements.avatar) {
            elements.avatar.textContent =
                username.charAt(0).toUpperCase();
        }

        if (elements.displayName) {
            elements.displayName.textContent = username;
        }

        if (elements.emailDisplay) {
            elements.emailDisplay.textContent = email;
        }

        if (elements.status) {
            elements.status.textContent =
                status.charAt(0).toUpperCase() + status.slice(1);

            elements.status.className = "status-badge";

            if (status === "active") {
                elements.status.classList.add("status-active");
            } else {
                elements.status.classList.add("status-suspended");
            }
        }

        if (elements.username) {
            elements.username.textContent = username;
        }

        if (elements.role) {
            elements.role.textContent = role;
        }

        if (elements.userId) {
            elements.userId.textContent = userId;
        }

        if (elements.createdAt) {
            elements.createdAt.textContent = formatDate(createdAt);
        }

        if (elements.editUsername) {
            elements.editUsername.value = username;
        }

        if (elements.editEmail) {
            elements.editEmail.value =
                email === "Not provided" ? "" : email;
        }
    }

   
    async function loadProfile() {
        try {
            clearMessage();

            const response = await API.getMyProfile();

            const profile = getProfileFromResponse(response);

            if (!profile || !getValue(profile, ["id", "user_id"], null)) {
                throw new Error(
                    "The profile response did not contain a valid user account."
                );
            }

            currentProfile = profile;

            displayProfile(profile);

            const storedUser = API.getCurrentUser() || {};

            const updatedUser = {
                ...storedUser,
                ...profile
            };

            API.setCurrentUser(updatedUser);

        } catch (error) {
            console.error("Profile loading failed:", error);

            showMessage(
                error.message || "Unable to load your profile.",
                "error"
            );
        }
    }

    
    async function updateProfile(event) {
        event.preventDefault();

        clearMessage();

        const username = elements.editUsername?.value.trim() || "";
        const email = elements.editEmail?.value.trim() || "";

        if (username.length < 3) {
            showMessage(
                "Username must contain at least 3 characters.",
                "error"
            );
            return;
        }

        if (!email) {
            showMessage(
                "Please enter your email address.",
                "error"
            );
            return;
        }

        const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

        if (!emailPattern.test(email)) {
            showMessage(
                "Please enter a valid email address.",
                "error"
            );
            return;
        }

        const originalUsername = getUsername(currentProfile);
        const originalEmail = getEmail(currentProfile);

        if (
            username === originalUsername &&
            email === originalEmail
        ) {
            showMessage(
                "No changes have been made to your profile.",
                "info"
            );
            return;
        }

        try {
            setButtonLoading(
                elements.saveProfileButton,
                true,
                "Saving...",
                "Save Changes"
            );

            const response = await API.updateMyProfile({
                username,
                email
            });

            const updatedProfile = getProfileFromResponse(response);

            currentProfile = updatedProfile &&
                getValue(updatedProfile, ["id", "user_id"], null)
                ? updatedProfile
                : {
                    ...currentProfile,
                    username,
                    email
                };

            displayProfile(currentProfile);

            const storedUser = API.getCurrentUser() || {};

            API.setCurrentUser({
                ...storedUser,
                ...currentProfile
            });

            showMessage(
                "Your profile has been updated successfully.",
                "success"
            );

        } catch (error) {
            console.error("Profile update failed:", error);

            showMessage(
                error.message || "Unable to update your profile.",
                "error"
            );

        } finally {
            setButtonLoading(
                elements.saveProfileButton,
                false,
                "Saving...",
                "Save Changes"
            );
        }
    }

    
    async function changePassword(event) {
        event.preventDefault();

        clearMessage();

        const currentPassword =
            elements.currentPassword?.value || "";

        const newPassword =
            elements.newPassword?.value || "";

        const confirmPassword =
            elements.confirmPassword?.value || "";

        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage(
                "Please complete all password fields.",
                "error"
            );
            return;
        }

        if (newPassword.length < 8) {
            showMessage(
                "Your new password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage(
                "The new password and confirmation do not match.",
                "error"
            );
            return;
        }

        if (currentPassword === newPassword) {
            showMessage(
                "Your new password must be different from your current password.",
                "error"
            );
            return;
        }

        try {
            setButtonLoading(
                elements.changePasswordButton,
                true,
                "Updating...",
                "Change Password"
            );

            await API.apiRequest("/users/me/change-password", {
                method: "POST",
                body: {
                    currentPassword,
                    newPassword
                }
            });

            elements.passwordForm?.reset();

            showMessage(
                "Your password has been changed successfully.",
                "success"
            );

        } catch (error) {
            console.error("Password change failed:", error);

            showMessage(
                error.message || "Unable to change your password.",
                "error"
            );

        } finally {
            setButtonLoading(
                elements.changePasswordButton,
                false,
                "Updating...",
                "Change Password"
            );
        }
    }

    

    function initializeEventListeners() {
        elements.profileForm?.addEventListener(
            "submit",
            updateProfile
        );

        elements.passwordForm?.addEventListener(
            "submit",
            changePassword
        );
    }


    function initializeProfilePage() {
        initializeEventListeners();
        loadProfile();
    }

    document.addEventListener(
        "DOMContentLoaded",
        initializeProfilePage
    );

    window.SmartMatatuProfile = {
        loadProfile,
        updateProfile,
        changePassword
    };

})();