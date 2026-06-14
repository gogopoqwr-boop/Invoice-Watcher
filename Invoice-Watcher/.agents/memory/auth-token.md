---
name: Auth token key
description: The generated customFetch reads auth tokens from localStorage["jwt"] automatically
---

The `lib/api-client-react/src/custom-fetch.ts` file already contains logic to read `localStorage.getItem("jwt")` and attach it as `Authorization: Bearer <token>` to every request.

**Why:** No need to pass headers manually in the use-auth hook or call setAuthTokenGetter. Just store the JWT under the key `"jwt"` in localStorage after login and all subsequent API calls will be authenticated automatically.

**How to apply:** After a successful login mutation, do `localStorage.setItem("jwt", token)`. On logout, `localStorage.removeItem("jwt")`.
