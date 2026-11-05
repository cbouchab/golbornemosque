/* Golborne Mosque — the volunteer sign-up form (volunteer.html → /api/volunteer). */
(function () {
  "use strict";

  const form = document.getElementById("volunteer-form");
  if (!form) return;
  const error = document.getElementById("volunteer-error");
  const done = document.getElementById("volunteer-done");
  const button = form.querySelector('button[type="submit"]');
  const startedAt = Date.now();
  const EMAIL = /^[^\s@<>()]+@[^\s@<>()]+\.[^\s@<>()]{2,}$/;

  const field = (name) => form.elements[name];

  function fail(message, name) {
    error.textContent = message;
    if (name) {
      field(name).setAttribute("aria-invalid", "true");
      field(name).focus();
    }
  }

  // A message about a field goes as soon as it's being corrected.
  form.addEventListener("input", (e) => {
    e.target.removeAttribute("aria-invalid");
    error.textContent = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    error.textContent = "";
    const data = Object.fromEntries(new FormData(form).entries());
    for (const k of Object.keys(data)) data[k] = String(data[k]).trim();

    if (!data.firstName) return fail("Please enter your first name.", "firstName");
    if (!data.lastName) return fail("Please enter your last name.", "lastName");
    if (!EMAIL.test(data.email)) return fail("Please check your email address.", "email");

    button.disabled = true;
    button.textContent = "Sending…";
    try {
      const res = await fetch("/api/volunteer", {
        method: "POST",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: JSON.stringify({ ...data, startedAt }),
      });
      const reply = await res.json().catch(() => ({}));
      if (!res.ok) {
        fail(
          reply.message || "Sorry, your details couldn’t be sent just now. Please try again, or email info@golbornemosque.org.",
          reply.field
        );
        return;
      }
      form.hidden = true;
      done.hidden = false;
      done.focus();
    } catch (err) {
      fail("Sorry, your details couldn’t be sent just now. Please check your connection and try again.");
    } finally {
      button.disabled = false;
      button.textContent = "Register";
    }
  });
})();
