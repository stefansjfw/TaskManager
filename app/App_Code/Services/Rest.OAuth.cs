using System;
using System.Collections.Generic;
using System.Drawing;
using System.IO;
using System.Net;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using System.Xml.XPath;
using Newtonsoft.Json.Linq;
using MyCompany.Data;
using MyCompany.Handlers;

namespace MyCompany.Services.Rest
{
    public partial class RESTfulResourceBase : RESTfulResourceConfiguration
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _oAuth;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _oAuthMethod;

        private JObject _idClaims;

        public const string AppIdentityUserScope = "urn:appidentity:user";

        public const string AppIdentityRedirectPath = "/appservices/saas/appidentity";

        public string OAuth
        {
            get
            {
                return _oAuth;
            }
            set
            {
                _oAuth = value;
            }
        }

        public string OAuthMethod
        {
            get
            {
                return _oAuthMethod;
            }
            set
            {
                _oAuthMethod = value;
            }
        }

        public string OAuthMethodName
        {
            get
            {
                var path = string.Format("{0}/{1}", HttpMethod.ToLower(), OAuth);
                if (!string.IsNullOrEmpty(OAuthMethod))
                    path = string.Format("{0}/{1}", path, OAuthMethod);
                return path;
            }
        }

        public string OAuthMethodPath
        {
            get
            {
                return OAuthMethodName.Substring((HttpMethod.Length + 1));
            }
        }

        public override JObject IdClaims
        {
            get
            {
                if (_idClaims == null)
                {
                    _idClaims = new JObject();
                    var authorization = HttpContext.Current.Request.Headers["Authorization"];
                    if (!string.IsNullOrEmpty(authorization) && authorization.StartsWith("Bearer ", StringComparison.OrdinalIgnoreCase))
                        ExecuteOAuthPostUserInfo(new JObject(), new JObject(), _idClaims);
                }
                return _idClaims;
            }
        }

        public static int DeviceUserCodeLength
        {
            get
            {
                return Convert.ToInt32(ApplicationServicesBase.SettingsProperty("server.rest.authorization.oauth2.device.userCodeLength", 8));
            }
        }

        public static string DeviceUserCodeCharSet
        {
            get
            {
                return Convert.ToString(ApplicationServicesBase.SettingsProperty("server.rest.authorization.oauth2.device.charSet", "BCDFGHJKLMPQRSTVXYZ"));
            }
        }

        public virtual void OAuthHypermedia(JProperty links, JObject result)
        {
            result["issuer"] = ApplicationServicesBase.Create().DisplayName;
            var appScopes = ((JObject)(ApplicationServicesBase.SettingsProperty("server.rest.scopes", new JObject())));
            var scopes = StandardScopes();
            var standardScopeList = new List<JProperty>(scopes.Properties());
            standardScopeList.Reverse();
            foreach (var scopeProp in standardScopeList)
                if (appScopes[scopeProp.Name] == null)
                    appScopes.AddFirst(new JProperty(scopeProp.Name, ((JObject)(scopeProp.Value))));
            result["scopes"] = appScopes;
            if (RESTfulResource.IsAuthorized("post/apps", OAuth2Schema))
                AddLink("apps", "GET", links, "~/oauth2/v2/apps");
            AddLink("authorize", "GET", links, "~/oauth2/v2/auth");
            AddLink("token", "POST", links, "~/oauth2/v2/token");
            AddLink("tokeninfo", "GET", links, "~/oauth2/v2/tokeninfo");
            AddLink("userinfo", "POST", links, "~/oauth2/v2/userinfo");
            AddLink("revoke", "POST", links, "~/oauth2/v2/revoke");
            AddLink("authorize-client-native", "POST", links, "~/oauth2/v2/auth/pkce");
            AddLink("authorize-client-spa", "POST", links, "~/oauth2/v2/auth/spa");
            AddLink("authorize-server", "POST", links, "~/oauth2/v2/auth/server");
            AddLink("authorize-device", "POST", links, "~/oauth2/v2/auth/device");
            AddLink("selfLink", "GET", links, "~/oauth2/v2");
            if (!RequiresSchema)
                AddLink("schema", "GET", links, string.Format("~/oauth2/v2?{0}=true", SchemaKey));
        }

        public virtual void ExecuteOAuth(JObject schema, JObject payload, JObject result)
        {
            // create OAuth2 authorization request
            if (OAuthMethodName == "get/auth")
                ExecuteOAuthGetAuth(schema, payload, result);
            // Process the authorization request
            if (OAuthMethodName == "post/auth")
                ExecuteOAuthPostAuth(schema, payload, result);
            // Exchange 'authorization_code' or 'refresh_token' for an access token
            if (OAuthMethodName == "post/token")
                ExecuteOAuthPostToken(schema, payload, result);
            // Exchange 'authorization_code' or 'refresh_token' for an access token
            if (OAuthMethodName == "post/revoke")
                ExecuteOAuthPostRevoke(schema, payload, result);
            // Get the Open ID user claims for a given access token
            if (OAuthMethodName == "post/userinfo")
                ExecuteOAuthPostUserInfo(schema, payload, result);
            // Get the user info such as photo, etc.
            if (OAuthMethodName.StartsWith("get/userinfo/pictures"))
                ExecuteOAuthGetUserInfoPictures(schema, payload, result);
            // Convert a device authorization rquest into the access request
            if (OAuthMethodName.StartsWith("post/auth/device"))
                ExecuteOAuthPostAuthDevice(schema, payload, result);
            // create 'authorization' and 'token' links with parameters
            if (OAuthMethodName.StartsWith("post/auth/"))
                ExecuteOAuthPostAuthClient(schema, payload, result);
            // get the list of client app records
            if (OAuthMethodName == "get/apps")
                ExecuteOAuthGetApps(schema, payload, result);
            // get the list of microservices
            if (OAuthMethodName == "get/services")
                ExecuteOAuthGetServices(schema, payload, result);
            // register a client app
            if (OAuthMethodName == "post/apps")
                ExecuteOAuthPostApps(schema, payload, result);
            // get the client app record
            if (OAuthMethodName.StartsWith("get/apps/"))
                ExecuteOAuthGetAppsSingleton(schema, payload, result, null);
            // delete the client app record
            if (OAuthMethodName.StartsWith("delete/apps/"))
                ExecuteOAuthDeleteAppsSingleton(schema, payload, result);
            // patch the client app record
            if (OAuthMethodName.StartsWith("patch/apps/"))
                ExecuteOAuthPatchAppsSingleton(schema, payload, result);
            // get information specified in 'id_token' parameter
            if (OAuthMethodName.StartsWith("get/tokeninfo"))
                ExecuteOAuthGetTokenInfo(schema, payload, result);
        }

        public virtual void ExecuteOAuthGetAuth(JObject schema, JObject payload, JObject result)
        {
            var authRequest = new JObject();
            // verify 'client_id'
            var clientApp = new JObject();
            ExecuteOAuthGetAppsSingleton(schema, payload, clientApp, "invalid_client");
            authRequest["date"] = DateTime.UtcNow.ToString("o");
            authRequest["name"] = clientApp["name"];
            authRequest["author"] = clientApp["author"];
            authRequest["trusted"] = Convert.ToBoolean(clientApp["trusted"]);
            authRequest["code"] = TextUtility.ToUrlEncodedToken(TextUtility.GetUniqueKey(40));
            authRequest["auth_remote_addr"] = App.RemoteAddress;
            // verify 'redirect_uri'
            string redirectUri = null;
            try
            {
                redirectUri = new Uri(((string)(payload["redirect_uri"]))).AbsoluteUri;
            }
            catch (Exception ex)
            {
                RESTfulResource.ThrowError("invalid_parameter", "Parameter 'redirect_uri': {0}", ex.Message);
            }
            if ((redirectUri == ((string)(clientApp["redirect_uri"]))) || (redirectUri == ((string)(clientApp["local_redirect_uri"]))))
                authRequest["redirect_uri"] = redirectUri;
            else
                RESTfulResource.ThrowError("invalid_parameter", "Parameter 'redirect_uri' does not match the redirect URIs of '{0}' client application.", clientApp["name"]);
            authRequest["client_id"] = clientApp["client_id"];
            var serverAuthorization = Convert.ToBoolean(clientApp.SelectToken("authorization.server"));
            var nativeAuthorization = Convert.ToBoolean(clientApp.SelectToken("authorization.native"));
            var spaAuthorization = Convert.ToBoolean(clientApp.SelectToken("authorization.spa"));
            if (serverAuthorization)
                authRequest["client_secret"] = TextUtility.ToUrlEncodedToken(((string)(clientApp["client_secret"])));
            var codeChallenge = ((string)(payload["code_challenge"]));
            var codeChallengeMethod = ((string)(payload["code_challenge_method"]));
            if (!(((nativeAuthorization || serverAuthorization) || spaAuthorization)))
                RESTfulResource.ThrowError("unauthorized", "Client application '{0}' is disabled.", clientApp["name"]);
            if (nativeAuthorization || serverAuthorization)
            {
                var codeVerificationRequired = (nativeAuthorization && !((spaAuthorization || serverAuthorization)));
                var clientSecretRequired = (serverAuthorization && !((nativeAuthorization || spaAuthorization)));
                if (string.IsNullOrEmpty(codeChallenge) && (codeVerificationRequired || !string.IsNullOrEmpty(codeChallengeMethod)))
                    RESTfulResource.ThrowError("invalid_argument", "Parameter 'code_challenge' is expected.");
                if (string.IsNullOrEmpty(codeChallengeMethod) && (codeVerificationRequired || !string.IsNullOrEmpty(codeChallenge)))
                    RESTfulResource.ThrowError("invalid_argument", "Parameter 'code_challenge_method' is expected.");
                if (clientSecretRequired)
                    authRequest["client_secret_required"] = true;
                authRequest["code_challenge"] = codeChallenge;
                authRequest["code_challenge_method"] = codeChallengeMethod;
                if (codeVerificationRequired)
                    authRequest["code_verifier_required"] = true;
            }
            else
            {
                if (!string.IsNullOrEmpty(codeChallenge))
                    RESTfulResource.ThrowError("invalid_parameter", "Unexpected parameter 'code_challenge' is specified.");
                if (!string.IsNullOrEmpty(codeChallengeMethod))
                    RESTfulResource.ThrowError("invalid_parameter", "Unexpected parameter 'code_challenge_method' is specified.");
            }
            CopyScope(payload, authRequest);
            authRequest["state"] = payload["state"];
            // delete the last request
            var cookie = HttpContext.Current.Request.Cookies[".oauth2"];
            if (cookie != null)
            {
                var lastOAuth2Request = Regex.Match(cookie.Value, "^(.+?)(\\:consent)?$");
                if (lastOAuth2Request.Success)
                    App.AppDataDelete(OAuth2FileName("requests", lastOAuth2Request.Groups[1].Value));
            }
            // create the new request
            var authData = authRequest.ToString();
            var authRef = TextUtility.ToUrlEncodedToken(authData);
            App.AppDataWriteAllText(OAuth2FileName("requests", authRef), authData);
            ApplicationServices.SetCookie(".oauth2", authRef, DateTime.Now.AddMinutes(AuthorizationRequestLifespan));
            var response = HttpContext.Current.Response;
            response.ContentType = "text/html";
            response.Write(string.Format("<html><head><meta http-equiv=\"Refresh\" content=\"0; URL={0}\"></head></html>", HttpUtility.HtmlAttributeEncode(HttpUtility.JavaScriptStringEncode(ApplicationServices.ResolveClientUrl(App.UserHomePageUrl())))));
            response.End();
        }

        public void CopyScope(JObject source, JObject target)
        {
            var scopeList = ScopeListFrom(source);
            if (scopeList.Count > 0)
            {
                var stdScopes = StandardScopes();
                var appScopes = ApplicationScopes();
                var scopeIndex = 0;
                while (scopeIndex < scopeList.Count)
                {
                    var scope = scopeList[scopeIndex];
                    if (((stdScopes[scope] != null) || ((appScopes[scope] != null) || IsAppIdentityScope(scope, source))) && (scopeList.IndexOf(scope) == scopeIndex))
                        scopeIndex++;
                    else
                        scopeList.RemoveAt(scopeIndex);
                }
                target["scope"] = string.Join(" ", scopeList);
            }
        }

        public virtual void ExecuteOAuthPostAuth(JObject schema, JObject payload, JObject result)
        {
            var authRequestFileName = OAuth2FileName("requests", payload["request_id"]);
            var authRequest = ReadOAuth2Data(authRequestFileName, null, "invalid_request", "Invalid OAuth2 authorization 'request_id' is specified.");
            App.AppDataDelete(authRequestFileName);
            // delete '.oauth2' cookie and the request data
            var cookie = HttpContext.Current.Request.Cookies[".oauth2"];
            if (cookie != null)
            {
                cookie.Expires = DateTime.Now.AddDays(-10);
                ApplicationServices.SetCookie(cookie);
                if (!cookie.Value.StartsWith(((string)(payload["request_id"]))))
                    RESTfulResource.ThrowError("invalid_argument", "The 'request_id' does not match the request authorization state.");
            }
            else
                RESTfulResource.ThrowError("invalid_state", "Application is not in the authorization state.");
            if (TextUtility.ToUniversalTime(authRequest["date"]).AddMinutes(AuthorizationRequestLifespan) < DateTime.UtcNow)
                RESTfulResource.ThrowError("invalid_argument", "Authorization request has expired.");
            authRequest["date"] = DateTime.UtcNow.AddMinutes(AuthorizationCodeLifespan);
            // save the username to the request
            if (Convert.ToBoolean(ApplicationServicesBase.SettingsProperty("membership.accountManager.enabled", true)) || !HttpContext.Current.User.Identity.IsAuthenticated)
                BearerAuthorizationHeader();
            authRequest["username"] = HttpContext.Current.User.Identity.Name;
            // create a response
            var links = CreateLinks(result);
            var deviceCode = ((string)(authRequest["device_code"]));
            var redirectUri = ((string)(authRequest["redirect_uri"]));
            var url = new UriBuilder(redirectUri);
            var urlQuery = HttpUtility.ParseQueryString(url.Query);
            var state = HttpUtility.UrlEncode(Convert.ToString(authRequest["state"]));
            if (((string)(payload["consent"])) == "allow")
            {
                if (string.IsNullOrEmpty(deviceCode))
                {
                    urlQuery["code"] = Convert.ToString(authRequest["code"]);
                    urlQuery["state"] = state;
                    authRequest["timezone"] = payload["timezone"];
                    authRequest["locale"] = System.Globalization.CultureInfo.CurrentCulture.Name;
                    TrimScopesIn(authRequest);
                    App.AppDataWriteAllText(OAuth2FileName("codes", authRequest["code"]), authRequest.ToString());
                }
                else
                {
                    App.AppDataDelete(authRequestFileName);
                    var deviceRequest = ReadOAuth2Data("devices", authRequest["device_code"], "inavlid_request", "The device authorization request does not exist or has expired.");
                    deviceRequest["username"] = authRequest["username"];
                    deviceRequest["access_granted"] = DateTime.UtcNow.ToString("o");
                    TrimScopesIn(deviceRequest);
                    deviceRequest["signature"] = TextUtility.Hash(deviceRequest.ToString());
                    App.AppDataWriteAllText(OAuth2FileName("devices", deviceRequest["device_code"]), deviceRequest.ToString());
                    urlQuery["user_code"] = "allow";
                }
            }
            else
            {
                if (string.IsNullOrEmpty(deviceCode))
                {
                    urlQuery["error"] = "access_denied";
                    urlQuery["state"] = state;
                }
                else
                {
                    App.AppDataDelete(authRequestFileName);
                    var deviceRequest = ReadOAuth2Data("devices", authRequest["device_code"], "inavlid_request", "The device authorization request does not exist or has expired.");
                    deviceRequest["username"] = null;
                    deviceRequest["access_denied"] = DateTime.UtcNow.ToString("o");
                    App.AppDataWriteAllText(OAuth2FileName("devices", deviceRequest["device_code"]), deviceRequest.ToString());
                    urlQuery["user_code"] = "deny";
                }
            }
            url.Query = urlQuery.ToString();
            AddLink("redirect-uri", "GET", links, ("_self:" + url.ToString()));
            OAuthCollectGarbage();
        }

        public virtual void OAuthCollectGarbage()
        {
            // Cleanup is performed when the user approves or denies the authorization request
            var filesToDelete = new List<string>();
            // 1. delete sys/oauth2/requests beyound the lifespan
            filesToDelete.AddRange(App.AppDataSearch("sys/oauth2/requests", "%.json", 3, DateTime.UtcNow.AddMinutes((-1 * AuthorizationRequestLifespan))));
            // 2. delete sys/oauth2/codes beyond the lifespan
            filesToDelete.AddRange(App.AppDataSearch("sys/oauth2/codes", "%.json", 3, DateTime.UtcNow.AddMinutes((-1 * AuthorizationCodeLifespan))));
            // 3. delete sys/oauth2/pictures beyond the lifespan (the duration of the id_token)
            filesToDelete.AddRange(App.AppDataSearch("sys/oauth2/pictures/%", "%.json", 3, DateTime.UtcNow.AddMinutes((-1 * PictureLifespan))));
            // 4. delete sys/oauth2/tokens of this user that have expired
            filesToDelete.AddRange(App.AppDataSearch("sys/oauth2/tokens/%", "%.json", 3, DateTime.UtcNow.AddMinutes((-1 * App.GetAccessTokenDuration("server.rest.authorization.oauth2.accessTokenDuration")))));
            foreach (var filename in filesToDelete)
                App.AppDataDelete(filename);
        }

        public static void EnsureRequiredField(JObject payload, string field, string error, string description)
        {
            var token = payload[field];
            if ((token == null) || (token.Type == JTokenType.Null))
                RESTfulResource.ThrowError(error, description);
        }

        public virtual void ExecuteOAuthPostToken(JObject schema, JObject payload, JObject result)
        {
            var grantType = ((string)(payload["grant_type"]));
            var clientId = Convert.ToString(payload["client_id"]);
            var clientSecret = Convert.ToString(payload["client_secret"]);
            var scopeListAdjusted = ScopeListFrom(payload);
            JObject tokenRequest = null;
            var refreshTokenRotation = false;
            if (grantType == "authorization_code")
            {
                EnsureRequiredField(payload, "code", "invalid_grant", "Field 'code' is expected in the body.");
                var authRequestFileName = OAuth2FileName("codes", payload["code"]);
                tokenRequest = ReadOAuth2Data(authRequestFileName, null, "invalid_grant", "The authorization code is invalid.");
                // validate the request
                if (clientId != Convert.ToString(tokenRequest["client_id"]))
                    RESTfulResource.ThrowError("invalid_client", "Invalid 'client_id' value is specified.");
                if (Convert.ToString(payload["redirect_uri"]) != Convert.ToString(tokenRequest["redirect_uri"]))
                    RESTfulResource.ThrowError("invalid_argument", "Invalid 'request_uri' value is specified.");
                if (Convert.ToBoolean(tokenRequest["client_secret_required"]) && string.IsNullOrEmpty(clientSecret))
                    RESTfulResource.ThrowError("invalid_client", "Field 'client_secret' is required.");
                if (!string.IsNullOrEmpty(clientSecret) && Convert.ToString(tokenRequest["client_secret"]) != TextUtility.ToUrlEncodedToken(clientSecret))
                    RESTfulResource.ThrowError("invalid_client", "Invalid 'client_secret' value is specified.");
                if (scopeListAdjusted.Count > 0)
                    RESTfulResource.ThrowError("invalid_scope", "The scope cannot be changed when exchanging the authorization code for the access token.");
                var codeVerifier = Convert.ToString(payload["code_verifier"]);
                var codeChallenge = Convert.ToString(tokenRequest["code_challenge"]);
                var codeChallengeMethod = Convert.ToString(tokenRequest["code_challenge_method"]);
                if (codeChallengeMethod == "S256")
                    codeVerifier = TextUtility.ToUrlEncodedToken(codeVerifier);
                if (Convert.ToBoolean(tokenRequest["code_verifier_required"]) && string.IsNullOrEmpty(codeVerifier))
                    RESTfulResource.ThrowError("invalid_argument", "Field 'code_verifier' is required.");
                if (!string.IsNullOrEmpty(codeVerifier) && codeVerifier != codeChallenge)
                    RESTfulResource.ThrowError("invalid_argument", "Invalid 'code_verifier' value is specified.");
                App.AppDataDelete(authRequestFileName);
                if (TextUtility.ToUniversalTime(tokenRequest["date"]).AddMinutes(AuthorizationCodeLifespan) < DateTime.UtcNow)
                    RESTfulResource.ThrowError("invalid_grant", "The authorization code has expired.");
            }
            if (grantType == "refresh_token")
            {
                EnsureRequiredField(payload, "refresh_token", "invalid_grant", "Field 'refresh_token' is expected in the body.");
                var refreshRequestFileName = OAuth2FileName("tokens/%", payload["refresh_token"]);
                tokenRequest = ReadOAuth2Data(refreshRequestFileName, null, "invalid_grant", "The refresh token is invalid.");
                if (clientId != Convert.ToString(tokenRequest["client_id"]))
                    RESTfulResource.ThrowError("invalid_client", "Invalid 'client_id' value is specified.");
                if (Convert.ToBoolean(tokenRequest["client_secret_required"]) && string.IsNullOrEmpty(clientSecret))
                    RESTfulResource.ThrowError("invalid_client", "Parameter 'client_secret' is required.");
                if (!string.IsNullOrEmpty(clientSecret) && TextUtility.ToUrlEncodedToken(clientSecret) != ((string)(tokenRequest["client_secret"])))
                    RESTfulResource.ThrowError("invalid_client", "Invalid 'client_secret' is specified.");
                // validate the refresh token
                var authTicket = FormsAuthentication.Decrypt(((string)(tokenRequest["token"])));
                if (authTicket.UserData != "REFRESHONLY")
                    RESTfulResource.ThrowError("invalid_grant", "The access token cannot be used to refresh.");
                refreshTokenRotation = Convert.ToBoolean(ApplicationServicesBase.SettingsProperty("server.rest.authorization.oauth2.refreshTokenRotation", true));
                var refreshTokenExpired = !App.ValidateTicket(authTicket);
                // delete the refresh token from the persistent storage
                if (refreshTokenRotation || refreshTokenExpired)
                    App.AppDataDelete(refreshRequestFileName);
                // delete the related access token from the persistent storage
                App.AppDataDelete(OAuth2FileName("tokens/%", tokenRequest["related_token"]));
                // ensure that the token has not expired
                if (refreshTokenExpired)
                    RESTfulResource.ThrowError("invalid_grant", "The refresh token has expired.");
                // adjust the scope list by reducing the number of avaialble scopes to those specified in the payload
                if (scopeListAdjusted.Count > 0)
                {
                    var tokenScopeList = ScopeListFrom(tokenRequest);
                    var newScopeList = new List<string>(tokenScopeList);
                    foreach (var tokenScope in tokenScopeList)
                        if (!scopeListAdjusted.Contains(tokenScope))
                            newScopeList.Remove(tokenScope);
                    tokenRequest["scope"] = string.Join(" ", newScopeList);
                }
            }
            if (grantType == "urn:ietf:params:oauth:grant-type:device_code")
            {
                var pollingDate = DateTime.UtcNow.ToString("o");
                var deviceCode = Convert.ToString(payload["device_code"]);
                var deviceRequestFileName = OAuth2FileName("devices", deviceCode);
                var deviceRequestData = App.AppDataReadAllText(deviceRequestFileName);
                string error = null;
                string errorDescription = null;
                var keepDeviceRequest = false;
                if (string.IsNullOrEmpty(deviceRequestData))
                {
                    error = "invalid_request";
                    if (string.IsNullOrEmpty(deviceCode))
                        errorDescription = "Specify the 'device_code' parameter.";
                    else
                        errorDescription = "Invalid 'device_code' value.";
                }
                else
                {
                    tokenRequest = TextUtility.ParseYamlOrJson(deviceRequestData);
                    if (TextUtility.ToUniversalTime(tokenRequest["expires"]) < DateTime.UtcNow)
                        error = "expired_token";
                    if (string.IsNullOrEmpty(error) && Convert.ToString(payload["client_id"]) != Convert.ToString(tokenRequest["client_id"]))
                    {
                        error = "invalid_request";
                        errorDescription = "Unrecognized 'client_id' is specified.";
                        keepDeviceRequest = true;
                    }
                    var lastPolled = Convert.ToString(tokenRequest["last_polled"]);
                    if (string.IsNullOrEmpty(error) && (!string.IsNullOrEmpty(lastPolled) && (TextUtility.ToUniversalTime(lastPolled).AddSeconds(Convert.ToInt32(tokenRequest["interval"])) > DateTime.UtcNow)))
                    {
                        error = "slow_down";
                        var pollingViolations = (Convert.ToInt32(tokenRequest["polling_violations"]) + 1);
                        if (pollingViolations <= MaxDevicePollingViolations)
                        {
                            keepDeviceRequest = true;
                            tokenRequest["polling_violations"] = (pollingViolations + 1);
                        }
                    }
                    if (string.IsNullOrEmpty(error) && (tokenRequest["username"] == null))
                    {
                        error = "authorization_pending";
                        tokenRequest["last_polled"] = pollingDate;
                        keepDeviceRequest = true;
                    }
                    if (string.IsNullOrEmpty(error))
                    {
                        var userName = Convert.ToString(tokenRequest["username"]);
                        if (string.IsNullOrEmpty(userName))
                            error = "access_denied";
                    }
                    if (string.IsNullOrEmpty(error))
                    {
                        var signature = ((string)(tokenRequest["signature"]));
                        tokenRequest.Remove("signature");
                        if (signature != TextUtility.Hash(tokenRequest.ToString()))
                        {
                            error = "access_denied";
                            errorDescription = "The device request signature is invalid.";
                        }
                    }
                }
                if (!string.IsNullOrEmpty(deviceRequestData))
                {
                    if (keepDeviceRequest)
                        App.AppDataWriteAllText(deviceRequestFileName, tokenRequest.ToString());
                    else
                    {
                        App.AppDataDelete(deviceRequestFileName);
                        App.AppDataDelete(OAuth2FileName("devices", Convert.ToString(tokenRequest["user_code"]).Replace("-", string.Empty)));
                    }
                }
                if (error != null)
                {
                    result["error"] = error;
                    if (!string.IsNullOrEmpty(errorDescription))
                        result["error_description"] = errorDescription;
                    HttpContext.Current.Response.StatusCode = 400;
                    return;
                }
            }
            // validate the user
            var user = Membership.GetUser(Convert.ToString(tokenRequest["username"]));
            if (user == null)
                RESTfulResource.ThrowError("invalid_user", "The user account does not exist.");
            if (!user.IsApproved)
                RESTfulResource.ThrowError("invalid_user", "The user account is not approved.");
            if (user.IsLockedOut)
                RESTfulResource.ThrowError("invalid_user", "The user account is locked.");
            // create the response with the access and refresh tokens
            var ticket = App.CreateTicket(user, null, "server.rest.authorization.oauth2.accessTokenDuration", "server.rest.authorization.oauth2.refreshTokenDuration");
            var tokenChars = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~+";
            // do not include "/" in the token
            var accessToken = TextUtility.GetUniqueKey(AccessTokenSize, tokenChars);
            result["access_token"] = accessToken;
            result["expires_in"] = (60 * App.GetAccessTokenDuration("server.rest.authorization.oauth2.accessTokenDuration"));
            result["token_type"] = "Bearer";
            tokenRequest["token"] = ticket.AccessToken;
            tokenRequest["token_type"] = "access";
            tokenRequest.Remove("related_token");
            tokenRequest["token_issued"] = DateTime.UtcNow.ToString("o");
            // create 'id_token'
            var idClaims = EnumerateIdClaims(grantType, user, tokenRequest);
            if ((idClaims != null) && (idClaims.Count > 0))
            {
                result["id_token"] = TextUtility.CreateJwt(idClaims);
                tokenRequest["id_token"] = idClaims;
            }
            // create 'access_token'
            tokenRequest["token_remote_addr"] = App.RemoteAddress;
            App.AppDataWriteAllText(OAuth2FileName(string.Format("tokens/{0}/access", HttpUtility.UrlEncode(user.UserName)), accessToken), tokenRequest.ToString());
            // create 'refresh_token'
            var refreshTokenDuration = App.GetAccessTokenDuration("server.rest.authorization.oauth2.refreshTokenDuration");
            if ((refreshTokenDuration > 0) && ((grantType != "refresh_token" && (Convert.ToBoolean(tokenRequest["trusted"]) || ScopeListFrom(tokenRequest).Contains("offline_access"))) || refreshTokenRotation))
            {
                var refreshToken = TextUtility.GetUniqueKey(RefreshTokenSize, tokenChars);
                result["refresh_token"] = refreshToken;
                tokenRequest["token"] = ticket.RefreshToken;
                tokenRequest["token_type"] = "refresh";
                tokenRequest["related_token"] = accessToken;
                tokenRequest.Remove("id_token");
                App.AppDataWriteAllText(OAuth2FileName(string.Format("tokens/{0}/refresh", HttpUtility.UrlEncode(user.UserName)), refreshToken), tokenRequest.ToString());
            }
            var scope = Convert.ToString(tokenRequest["scope"]);
            if (!string.IsNullOrEmpty(scope))
                result["scope"] = scope;
        }

        public virtual void ExecuteOAuthPostRevoke(JObject schema, JObject payload, JObject result)
        {
            var clientId = Convert.ToString(payload["client_id"]);
            var clientSecret = Convert.ToString(payload["client_secret"]);
            var tokenRequest = ReadOAuth2Data(OAuth2FileName("%", payload["token"]), null, "invalid_grant", "Invalid or expired token is specified.");
            // validate the request
            if (clientId != Convert.ToString(tokenRequest["client_id"]))
                RESTfulResource.ThrowError("invalid_client", "Invalid 'client_id' value is specified.");
            if (Convert.ToBoolean(tokenRequest["client_secret_required"]) && string.IsNullOrEmpty(clientSecret))
                RESTfulResource.ThrowError("invalid_client", "Field 'client_secret' is required.");
            if (!string.IsNullOrEmpty(clientSecret) && Convert.ToString(tokenRequest["client_secret"]) != TextUtility.ToUrlEncodedToken(clientSecret))
                RESTfulResource.ThrowError("invalid_client", "Invalid 'client_secret' value is specified.");
            // delete the token and the related token if any
            App.AppDataDelete(OAuth2FileName("%", payload["token"]));
            var relatedToken = ((string)(tokenRequest["related_token"]));
            if (relatedToken != null)
                App.AppDataDelete(OAuth2FileName("%", relatedToken));
        }

        public string BearerAuthorizationHeader()
        {
            var authorization = HttpContext.Current.Request.Headers["Authorization"];
            if (string.IsNullOrEmpty(authorization) || !authorization.StartsWith("Bearer "))
                RESTfulResource.ThrowError(403, "unauthorized", "Specify an access token in the Bearer 'Authorization' header.");
            return authorization.Substring("Bearer ".Length);
        }

        public virtual void ExecuteOAuthGetUserInfoPictures(JObject schema, JObject payload, JObject result)
        {
            var type = ((string)(payload["type"]));
            var filename = ((string)(payload["filename"]));
            MembershipUser user = null;
            if (string.IsNullOrEmpty(filename))
            {
                var authorization = BearerAuthorizationHeader();
                var accessToken = ReadOAuth2Data("tokens/%", authorization, "invalid_token", "Invalid or expired access token.");
                user = Membership.GetUser();
            }
            else
            {
                var picture = ReadOAuth2Data("pictures/%", Path.GetFileNameWithoutExtension(filename), "invalid_path", string.Format("User picture {0} '{1}' does not exist.", type, filename));
                user = Membership.GetUser(((string)(picture["username"])));
                if (user == null)
                    RESTfulResource.ThrowError(404, "invalid_path", "The user does not exist.");
            }
            byte[] imageData = null;
            string imageContentType = null;
            if (!TryGetUserImage(user, type, out imageData, out imageContentType))
                RESTfulResource.ThrowError(404, "invalid_path", "User photo does not exist.");
            var response = HttpContext.Current.Response;
            response.ContentType = imageContentType;
            response.Cookies.Clear();
            response.Headers.Remove("Set-Cookie");
            response.Cache.SetMaxAge(TimeSpan.FromMinutes(PictureLifespan));
            response.OutputStream.Write(imageData, 0, imageData.Length);
            response.End();
        }

        public static bool TryGetUserImage(MembershipUser user, string type, out byte[] data, out string contentType)
        {
            data = null;
            contentType = null;
            var app = ApplicationServicesBase.Current;
            var url = app.UserPictureUrl(user);
            if (!string.IsNullOrEmpty(url))
            {
                var request = WebRequest.Create(url);
                using (var imageResponse = request.GetResponse())
                {
                    using (var stream = imageResponse.GetResponseStream())
                    {
                        using (var ms = new MemoryStream())
                        {
                            contentType = imageResponse.ContentType;
                            data = ms.ToArray();
                        }
                    }
                }
            }
            else
            {
                url = app.UserPictureFilePath(user);
                if (!string.IsNullOrEmpty(url))
                {
                    data = File.ReadAllBytes(url);
                    contentType = ("image/" + Path.GetExtension(url).Substring(1));
                }
            }
            if ((data == null) && ApplicationServicesBase.IsSiteContentEnabled)
            {
                var list = app.ReadSiteContent("sys/users", (user.UserName + ".%"));
                foreach (var file in list)
                    if (file.ContentType.StartsWith("image/") && (file.Data != null))
                    {
                        data = file.Data;
                        contentType = file.ContentType;
                        break;
                    }
            }
            if (data == null)
                return false;
            if (type == "thumbnail")
            {
                var img = ((Image)(new ImageConverter().ConvertFrom(data)));
                var thumbnailSize = 96;
                if ((img.Width > thumbnailSize) || (img.Height > thumbnailSize))
                {
                    var scale = (((float)(img.Width)) / thumbnailSize);
                    var height = ((int)((img.Height / scale)));
                    var width = thumbnailSize;
                    if (img.Height < img.Width)
                    {
                        scale = (((float)(img.Height)) / thumbnailSize);
                        height = thumbnailSize;
                        width = ((int)((img.Width / scale)));
                    }
                    var originalImg = img;
                    if (height > width)
                    {
                        width = ((int)((((float)(width)) * (((float)(thumbnailSize)) / ((float)(height))))));
                        height = thumbnailSize;
                    }
                    img = Blob.ResizeImage(img, width, height);
                    originalImg.Dispose();
                }
                using (var output = new MemoryStream())
                {
                    var encoderParams = new System.Drawing.Imaging.EncoderParameters(1);
                    encoderParams.Param[0] = new System.Drawing.Imaging.EncoderParameter(System.Drawing.Imaging.Encoder.Quality, Convert.ToInt64(85));
                    img.Save(output, Blob.ImageFormatToEncoder(System.Drawing.Imaging.ImageFormat.Jpeg), encoderParams);
                    data = output.ToArray();
                    contentType = "image/jpeg";
                }
                img.Dispose();
            }
            return true;
        }

        public virtual void ExecuteOAuthPostUserInfo(JObject schema, JObject payload, JObject result)
        {
            var authorization = BearerAuthorizationHeader();
            var accessToken = ReadOAuth2Data("tokens/%", authorization, "invalid_token", "Invalid or expired access token.");
            var authParam = Convert.ToString(payload["auth"]);
            var claims = ((JObject)(accessToken["id_token"]));
            if (!string.IsNullOrEmpty(authParam))
            {
                var basicAuth = RESTfulResource.AuthorizationToLogin(authParam);
                if (basicAuth == null)
                    RESTfulResource.ThrowError("invalid_parameter", "The value of the 'auth' parameter must specify a valid basic HTTP authorization in 'Basic <credentials>' format, where credentials is the base-64 encoding of ID and password joined by a single colon character.");
                var appReg = ReadOAuth2Data("apps", basicAuth[0], "invalid_client", string.Format("Client application '{0}' is not registered.", basicAuth[0]));
                if (Convert.ToString(appReg["client_secret"]) != basicAuth[1])
                    RESTfulResource.ThrowError(403, "invalid_parameter", "The invalid 'client_secret' value is specified in the 'auth' parameter.");
                accessToken["appidentity_verified"] = true;
                claims = EnumerateIdClaims("authorization_code", Membership.GetUser(), accessToken);
            }
            if (claims == null)
                claims = EnumerateIdClaims("authorization_code", Membership.GetUser(), accessToken);
            else
            {
                if (!Convert.ToBoolean(accessToken["appidentity_verified"]))
                    claims.Remove("appidentity");
            }
            if ((claims != null) && (Convert.ToBoolean(accessToken["trusted"]) || ScopeListFrom(accessToken).Contains("offline_access")))
                foreach (var p in claims.Properties())
                    if (!Regex.IsMatch(p.Name, "^(aud|azp|exp|iat|iss)$"))
                        result.Add(p);
        }

        public virtual void ExecuteOAuthGetTokenInfo(JObject schema, JObject payload, JObject result)
        {
            var idToken = ((string)(payload["id_token"]));
            if (TextUtility.ValidateJwt(idToken))
            {
                var claims = TextUtility.ParseYamlOrJson(Encoding.UTF8.GetString(TextUtility.FromBase64UrlEncoded(idToken.Split('.')[1])));
                var exp = claims["exp"];
                if (exp != null)
                    claims.AddFirst(new JProperty("active", (DateTimeOffset.UtcNow.ToUnixTimeSeconds() < Convert.ToInt64(exp))));
                foreach (var p in claims.Properties())
                    result.Add(p);
                var jose = TextUtility.ParseYamlOrJson(Encoding.UTF8.GetString(TextUtility.FromBase64UrlEncoded(idToken.Split('.')[0])));
                result["alg"] = jose["alg"];
            }
            else
                RESTfulResource.ThrowError("invalid_token", "The token specified in 'id_token' parameter is invalid.");
        }

        protected virtual JObject ReadOAuth2Data(string path, object id, string error, string errorDescription)
        {
            if (id != null)
                path = OAuth2FileName(path, id);
            var data = App.AppDataReadAllText(path);
            if (data == null)
                RESTfulResource.ThrowError(error, errorDescription);
            return TextUtility.ParseYamlOrJson(data);
        }

        public virtual List<string> ScopeListFrom(JObject context)
        {
            var scope = Convert.ToString(context["scope"]);
            return new List<string>(scope.Split(new char[] {
                            ' ',
                            ','}, StringSplitOptions.RemoveEmptyEntries));
        }

        public virtual bool TrimScopesIn(JObject context)
        {
            var changed = false;
            var scopeList = ScopeListFrom(context);
            var user = HttpContext.Current.User;
            if (user.Identity.IsAuthenticated)
            {
                var appScopes = ApplicationScopes();
                var stdScopes = StandardScopes();
                var i = 0;
                while (i < scopeList.Count)
                {
                    var scope = scopeList[i];
                    var scopeDef = appScopes[scope];
                    if (scopeDef != null)
                    {
                        var roles = Convert.ToString(scopeDef["role"]).Split(new char[] {
                                    ' ',
                                    ','}, StringSplitOptions.RemoveEmptyEntries);
                        if (roles.Length > 0)
                        {
                            if (DataControllerBase.UserIsInRole(roles))
                                i++;
                            else
                            {
                                changed = true;
                                scopeList.RemoveAt(i);
                            }
                        }
                        else
                            i++;
                    }
                    else
                    {
                        if ((stdScopes[scope] == null) && !IsAppIdentityScope(scope, context))
                        {
                            changed = true;
                            scopeList.RemoveAt(i);
                        }
                        else
                            i++;
                    }
                }
            }
            if (changed)
                context["scope"] = string.Join(" ", scopeList);
            return changed;
        }

        public virtual bool IsAppIdentityScope(List<string> scopes, JObject context)
        {
            return (scopes.Contains(AppIdentityUserScope) && IsAppIdentityScope(AppIdentityUserScope, context));
        }

        public virtual bool IsAppIdentityScope(string scope, JObject context)
        {
            return ((scope == AppIdentityUserScope) && Convert.ToString(context["redirect_uri"]).EndsWith(AppIdentityRedirectPath));
        }

        public virtual JObject EnumerateIdClaims(string grantType, MembershipUser user, JObject context)
        {
            if ((IdTokenDuration > 0) && (grantType != "refresh_token" || ((grantType == "refresh_token") && Convert.ToBoolean(ApplicationServices.SettingsProperty("server.rest.authorization.oauth2.idTokenRefresh", true)))))
            {
                var scopeList = ScopeListFrom(context);
                var clientId = Convert.ToString(context["client_id"]);
                var claims = new JObject();
                // "openid" scope
                if (scopeList.Contains("openid"))
                {
                    claims["iss"] = ApplicationServicesBase.ResolveClientUrl("~/oauth2/v2");
                    claims["azp"] = clientId;
                    var redirectUri = Convert.ToString(context["redirect_uri"]);
                    if (redirectUri.EndsWith(AppIdentityRedirectPath))
                        redirectUri = redirectUri.Substring(0, (redirectUri.Length - AppIdentityRedirectPath.Length));
                    claims["aud"] = redirectUri;
                    claims["sub"] = JToken.FromObject(user.ProviderUserKey);
                    claims["iat"] = DateTimeOffset.UtcNow.ToUnixTimeSeconds();
                    claims["exp"] = DateTimeOffset.UtcNow.AddMinutes(IdTokenDuration).ToUnixTimeSeconds();
                }
                else
                    return null;
                if (scopeList.Contains("email"))
                {
                    claims["email"] = user.Email;
                    claims["email_verified"] = true;
                }
                // "profile" scope
                if (scopeList.Contains("profile"))
                {
                    claims["name"] = null;
                    claims["given_name"] = null;
                    claims["family_name"] = null;
                    claims["middle_name"] = null;
                    claims["nickname"] = null;
                    claims["preferred_username"] = null;
                    claims["profile"] = null;
                    claims["picture"] = ToPictureClaim(user);
                    if (OAuth == "userinfo")
                    {
                        var picture = ((string)(claims["picture"]));
                        if (!string.IsNullOrEmpty(picture))
                            claims["picture_thumbnail"] = ApplicationServicesBase.ResolveClientUrl(string.Format("~/oauth2/v2/userinfo/pictures/thumbnail/{0}.jpeg", Path.GetFileNameWithoutExtension(picture)));
                    }
                    claims["gender"] = null;
                    claims["birthdate"] = null;
                    claims["zoneinfo"] = context["timezone"];
                    claims["locale"] = context["locale"];
                    claims["updated_at"] = null;
                }
                // "address" scope
                if (scopeList.Contains("address"))
                {
                    var address = new JObject();
                    claims["address"] = address;
                    address["formatted"] = null;
                    address["street_address"] = null;
                    address["locality"] = null;
                    address["region"] = null;
                    address["postal_code"] = null;
                    address["country"] = null;
                }
                // "phone" scope
                if (scopeList.Contains("phone"))
                {
                    claims["phone_number"] = null;
                    claims["phone_number_verified"] = false;
                }
                if (Convert.ToBoolean(context["appidentity_verified"]) || IsAppIdentityScope(scopeList, context))
                {
                    var appIdentity = new JObject();
                    claims.Add(new JProperty("appidentity", appIdentity));
                    appIdentity["username"] = user.UserName;
                    appIdentity["email"] = user.Email;
                    appIdentity["roles"] = new JArray(Roles.GetRolesForUser(user.UserName));
                    if (claims.ContainsKey("picture"))
                        appIdentity["picture"] = claims["picture"];
                    else
                        appIdentity["picture"] = ToPictureClaim(user);
                }
                if (scopeList.Count > 0)
                    claims["scope"] = context["scope"];
                App.EnumerateIdClaims(user, claims, scopeList, context);
                return claims;
            }
            return null;
        }

        public string ToPictureClaim(MembershipUser user)
        {
            try
            {
                var pictureData = App.AppDataReadAllText(string.Format("sys/oauth2/pictures/{0}/%.json", HttpUtility.UrlEncode(user.UserName)));
                JObject picture = null;
                if (pictureData != null)
                    picture = TextUtility.ParseYamlOrJson(pictureData);
                if ((picture != null) && (TextUtility.ToUniversalTime(picture["date"]).AddMinutes(PictureLifespan) < DateTime.UtcNow))
                {
                    App.AppDataDelete(string.Format("sys/oauth2/pictures/%/{0}.json", picture["id"]));
                    pictureData = null;
                }
                if (pictureData == null)
                {
                    byte[] imageData = null;
                    string imageContentType = null;
                    if (TryGetUserImage(user, "original", out imageData, out imageContentType))
                    {
                        picture = new JObject();
                        picture["username"] = user.UserName;
                        picture["id"] = TextUtility.ToUrlEncodedToken(Guid.NewGuid().ToString());
                        picture["date"] = DateTime.UtcNow.ToString("o");
                        picture["contentType"] = imageContentType;
                        picture["extension"] = ((string)(picture["contentType"])).Split('/')[1];
                        pictureData = picture.ToString();
                        App.AppDataWriteAllText(string.Format("sys/oauth2/pictures/{0}/{1}.json", HttpUtility.UrlEncode(user.UserName), picture["id"]), pictureData);
                    }
                }
                if (picture != null)
                    return ApplicationServicesBase.ResolveClientUrl(string.Format("~/oauth2/v2/userinfo/pictures/original/{0}.{1}", picture["id"], picture["extension"]));
                else
                    return null;
            }
            catch (Exception ex)
            {
                return ex.Message;
            }
        }

        public virtual void ExecuteOAuthPostAuthDevice(JObject schema, JObject payload, JObject result)
        {
            var userCode = Convert.ToString(payload["user_code"]);
            var appReg = new JObject();
            if (string.IsNullOrEmpty(userCode))
            {
                ExecuteOAuthGetAppsSingleton(schema, payload, appReg, "invalid_client");
                if (!Convert.ToBoolean(appReg.SelectToken("authorization.device")))
                    RESTfulResource.ThrowError("invalid_client", "Client application '{0}' does not support the Device Authorization Flow.", payload["client_id"]);
                result["device_code"] = TextUtility.GetUniqueKey(40);
                userCode = TextUtility.GetUniqueKey(DeviceUserCodeLength, DeviceUserCodeCharSet);
                var middleIndex = (userCode.Length / 2);
                result["user_code"] = (userCode.Substring(0, middleIndex) + ("-" + userCode.Substring(middleIndex)));
                result["redirect_uri"] = ApplicationServices.ResolveClientUrl("~/device");
                result["interval"] = ApplicationServicesBase.SettingsProperty("server.rest.authorization.oauth2.device.interval", 5);
                var expiresIn = Convert.ToInt32(ApplicationServicesBase.SettingsProperty("server.rest.authorization.oauth2.device.expiresIn", 600));
                result["expires_in"] = expiresIn;
                var tokenData = new JObject();
                result["token"] = tokenData;
                tokenData["grant_type"] = "urn:ietf:params:oauth:grant-type:device_code";
                tokenData["client_id"] = payload["client_id"];
                tokenData["device_code"] = result["device_code"];
                var request = result.DeepClone();
                var tokenLinks = CreateLinks(tokenData);
                AddLink("self", "POST", tokenLinks, "~/oauth2/v2/token");
                request["date"] = DateTime.UtcNow.ToString("o");
                request["expires"] = DateTime.UtcNow.AddSeconds(expiresIn).ToString("o");
                request["scope"] = payload["scope"];
                request["name"] = appReg["name"];
                request["author"] = appReg["author"];
                request["trusted"] = Convert.ToBoolean(appReg["trusted"]);
                request["client_id"] = payload["client_id"];
                foreach (var fileToDelete in App.AppDataSearch("sys/oauth2/devices", "%.json", 6, DateTime.UtcNow.AddSeconds((-1 * expiresIn))))
                    App.AppDataDelete(fileToDelete);
                App.AppDataWriteAllText(OAuth2FileName("devices", userCode), request.ToString());
                App.AppDataWriteAllText(OAuth2FileName("devices", result["device_code"]), request.ToString());
            }
            else
            {
                // user has entered the user code on the  ~/device page
                userCode = userCode.Replace("-", string.Empty);
                var deviceDataPath = OAuth2FileName("devices", userCode);
                var deviceData = App.AppDataReadAllText(deviceDataPath);
                if (string.IsNullOrEmpty(deviceData))
                    RESTfulResource.ThrowError(404, "invalid_user_code", "The user code does not match a request from a device to connect.");
                var deviceRequest = TextUtility.ParseYamlOrJson(deviceData);
                // confirm that the Device Authoriation Flow is allowed for the app
                ExecuteOAuthGetAppsSingleton(schema, deviceRequest, appReg, "invalid_client");
                if (!Convert.ToBoolean(appReg.SelectToken("authorization.device")))
                {
                    App.AppDataDelete(OAuth2FileName("devices", userCode));
                    App.AppDataDelete(OAuth2FileName("devices", deviceRequest["device_code"]));
                    RESTfulResource.ThrowError("invalid_client", "Client application '{0}' does not support the Device Authorization Flow.", payload["client_id"]);
                }
                if (TextUtility.ToUniversalTime(deviceRequest["expires"]) < DateTime.UtcNow)
                {
                    App.AppDataDelete(OAuth2FileName("devices", userCode));
                    App.AppDataDelete(OAuth2FileName("devices", deviceRequest["device_code"]));
                    RESTfulResource.ThrowError("expired_token", "The device authorization request has expired.");
                }
                App.AppDataDelete(OAuth2FileName("devices", userCode));
                CopyScope(deviceRequest, deviceRequest);
                // create a user authorization request that must be set as ".oauth2" cookie with the 'code' value
                var authData = deviceRequest.ToString();
                var authRef = TextUtility.ToUrlEncodedToken(authData);
                App.AppDataWriteAllText(OAuth2FileName("requests", authRef), authData);
                result["code"] = authRef;
                result["expiresIn"] = (AuthorizationRequestLifespan * 60);
                var links = CreateLinks(result);
                AddLink("redirect", "GET", links, ApplicationServicesBase.ResolveClientUrl(App.UserHomePageUrl()));
            }
        }

        public virtual void ExecuteOAuthPostAuthClient(JObject schema, JObject payload, JObject result)
        {
            var authorizeLinkInfo = Regex.Match(OAuthMethodName, "post/auth/(pkce|spa|server)");
            if (authorizeLinkInfo.Success)
            {
                var inputSchema = ((JObject)(schema["_input"]));
                var links = CreateLinks(result, true);
                var appReg = new JObject();
                ExecuteOAuthGetAppsSingleton(schema, payload, appReg, "invalid_client");
                var isPKCE = (authorizeLinkInfo.Groups[1].Value == "pkce");
                var isServer = (authorizeLinkInfo.Groups[1].Value == "server");
                if (isServer)
                    isPKCE = true;
                var state = ((string)(GetPropertyValue(payload, "state", inputSchema)));
                if (string.IsNullOrEmpty(state))
                    state = TextUtility.GetUniqueKey(16);
                result["state"] = state;
                string codeChallenge = null;
                string codeChallengeMethod = null;
                string codeVerifier = null;
                if (isPKCE)
                {
                    codeChallenge = ((string)(GetPropertyValue(payload, "code_challenge", inputSchema)));
                    codeChallengeMethod = ((string)(GetPropertyValue(payload, "code_challenge_method", inputSchema)));
                    if (string.IsNullOrEmpty(codeChallengeMethod))
                        codeChallengeMethod = "S256";
                    if (string.IsNullOrEmpty(codeChallenge))
                        codeChallenge = TextUtility.GetUniqueKey(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~");
                    codeVerifier = codeChallenge;
                    if (codeChallengeMethod == "S256")
                        codeChallenge = TextUtility.ToUrlEncodedToken(codeChallenge);
                }
                var token = new JObject();
                AddLink("selfLink", "POST", CreateLinks(token), "{0}/oauth2/v2/token", ApplicationServices.ResolveClientUrl("~/"));
                result.Add(new JProperty("token", token));
                token["grant_type"] = "authorization_code";
                token["code"] = null;
                var redirectUri = Convert.ToString(payload["redirect_uri"]);
                if (redirectUri != Convert.ToString(appReg["redirect_uri"]) && redirectUri != Convert.ToString(appReg["local_redirect_uri"]))
                    RESTfulResource.ThrowError("invalid_argument", "The 'redirect_uri' value does not match the URIs of the '{0}' client application registration.", appReg["name"]);
                token["redirect_uri"] = redirectUri;
                token["client_id"] = payload["client_id"];
                if (isServer)
                {
                    var clientSecret = Convert.ToString(payload["client_secret"]);
                    if (clientSecret != Convert.ToString(appReg["client_secret"]))
                        RESTfulResource.ThrowError("invalid_client", "The 'client_secret' value does not match the client application registration.");
                    token["client_secret"] = clientSecret;
                }
                if (isPKCE)
                    token["code_verifier"] = codeVerifier;
                var url = new StringBuilder();
                var clientIdParam = GetPropertyValue(payload, "client_id", inputSchema);
                var redirectUriParam = HttpUtility.UrlEncode(((string)(GetPropertyValue(payload, "redirect_uri", inputSchema))));
                var scopeParam = HttpUtility.UrlEncode(((string)(GetPropertyValue(payload, "scope", inputSchema))));
                url.AppendFormat("{0}/oauth2/v2/auth?response_type=code&client_id={1}&redirect_uri={2}&scope={3}&state={4}", ApplicationServices.ResolveClientUrl("~/"), clientIdParam, redirectUriParam, scopeParam, HttpUtility.UrlEncode(state));
                if (isPKCE)
                    url.AppendFormat("&code_challenge={0}&code_challenge_method={1}", HttpUtility.UrlEncode(codeChallenge), codeChallengeMethod);
                AddLink("authorize", "GET", links, url.ToString());
            }
        }

        public virtual void ExecuteOAuthAppsValidate(JObject result)
        {
            var url = Convert.ToString(result["redirect_uri"]);
            if (!string.IsNullOrEmpty(url))
                try
                {
                    result["redirect_uri"] = new Uri(url).AbsoluteUri;
                }
                catch (Exception ex)
                {
                    RESTfulResource.ThrowError("invalid_argument", ("Invalid 'redirect_uri' value. " + ex.Message));
                }
            url = Convert.ToString(result["local_redirect_uri"]);
            if (!string.IsNullOrEmpty(url))
                try
                {
                    var redirectUri = new Uri(url);
                    if (!Regex.IsMatch(redirectUri.Scheme, "^https?$"))
                        throw new Exception("Only 'http' and 'https' protocols are allowed.");
                    if (redirectUri.Host != "localhost")
                        throw new Exception(string.Format("Host '{0}' is not allowed. Use 'localhost' instead.", redirectUri.Host));
                    result["local_redirect_uri"] = redirectUri.AbsoluteUri;
                }
                catch (Exception ex)
                {
                    RESTfulResource.ThrowError("invalid_argument", ("Invalid 'local_redirect_uri' value. " + ex.Message));
                }
            if (Convert.ToBoolean(result.SelectToken("authorization.server")))
            {
                if (string.IsNullOrEmpty(((string)(result["client_secret"]))))
                    result["client_secret"] = TextUtility.GetUniqueKey(64, "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890-._~");
            }
            else
                result.Remove("client_secret");
        }

        protected virtual string ExecuteOAuthAppsLinks(JObject result)
        {
            var clientId = ((string)(result["client_id"]));
            var resourceLocation = ("~/oauth2/v2/apps/" + clientId);
            var links = CreateLinks(result, true);
            AddLink("selfLink", "GET", links, resourceLocation);
            AddLink("editLink", "PATCH", links, resourceLocation);
            AddLink("deleteLink", "DELETE", links, resourceLocation);
            return resourceLocation;
        }

        public virtual void ExecuteOAuthPostApps(JObject schema, JObject payload, JObject result)
        {
            var clientId = TextUtility.GetUniqueKey(43);
            result["name"] = payload["name"];
            result["author"] = payload["author"];
            result["client_id"] = clientId;
            if (payload["client_secret"] != null)
                result["client_secret"] = payload["client_secret"];
            result["redirect_uri"] = payload["redirect_uri"];
            if (payload["local_redirect_uri"] != null)
                result["local_redirect_uri"] = payload["local_redirect_uri"];
            var authorization = payload["authorization"];
            if (authorization == null)
                RESTfulResource.ThrowError(404, "invalid_parameter", "Field 'authorization' is required.");
            result["authorization"] = authorization;
            result["trusted"] = payload["trusted"];
            ExecuteOAuthAppsValidate(result);
            App.AppDataWriteAllText(OAuth2FileName("apps", clientId), result.ToString());
            ExecuteOAuthAppsUpdateCORs(result, new JObject());
            HttpContext.Current.Response.StatusCode = 201;
            HttpContext.Current.Response.Headers["Location"] = ToServiceUrl(ExecuteOAuthAppsLinks(result));
        }

        public virtual void ExecuteOAuthGetApps(JObject schema, JObject payload, JObject result)
        {
            var regList = App.AppDataSearch("sys/oauth2/apps", "%.json");
            var collection = new JArray();
            result["count"] = regList.Length;
            result[CollectionKey] = collection;
            var sortedApps = new SortedDictionary<string, JObject>();
            foreach (var filename in regList)
            {
                var appReg = TextUtility.ParseYamlOrJson(App.AppDataReadAllText(filename));
                var item = new JObject();
                foreach (var p in appReg.Properties())
                    if ((p.Name == "client_secret") && p.Value.Type != JTokenType.Null)
                    {
                        var secret = Convert.ToString(p.Value);
                        if (secret.Length > 6)
                            secret = secret.Substring((secret.Length - 6)).PadLeft((secret.Length - 6), '*');
                        item.Add(p.Name, secret);
                    }
                    else
                        item.Add(p);
                var itemLinks = CreateLinks(item);
                if (itemLinks != null)
                    AddLink("selfLink", "GET", itemLinks, "~/oauth2/v2/apps/{0}", appReg["client_id"]);
                var appName = ((string)(item["name"]));
                if (sortedApps.ContainsKey(appName))
                    appName = ((string)(item["client_id"]));
                sortedApps[appName] = item;
            }
            foreach (var name in sortedApps.Keys)
                collection.Add(sortedApps[name]);
            // add links
            var links = CreateLinks(result);
            if (links != null)
            {
                AddLink("selfLink", "GET", links, "~/oauth2/v2/apps");
                AddLink("createLink", "POST", links, "~/oauth2/v2/apps");
            }
        }

        public virtual void ExecuteOAuthGetServices(JObject schema, JObject payload, JObject result)
        {
            var links = CreateLinks(result);
            if (links == null)
                return;
            AddLink("selfLink", "GET", links, "~/oauth2/v2/services");
            AddLink("oauth2", "GET", links, "~/oauth2/v2");
            var sortedApps = new SortedDictionary<string, JObject>();
            foreach (var filename in App.AppDataSearch("sys/oauth2/apps", "%.json"))
            {
                var appReg = TextUtility.ParseYamlOrJson(App.AppDataReadAllText(filename));
                sortedApps[Convert.ToString(appReg["name"])] = appReg;
            }
            var count = 0;
            var includeLocal = HttpContext.Current.Request.IsLocal;
            foreach (var appName in sortedApps.Keys)
            {
                var appReg = sortedApps[appName];
                var redirectUri = Convert.ToString(appReg["redirect_uri"]);
                if (redirectUri.EndsWith(AppIdentityRedirectPath))
                {
                    JObject serviceLink;
                    var serviceName = TextToPathName(appName);
                    var link = AddLink(serviceName, "GET", links, new Uri(new Uri(redirectUri.Substring(0, (redirectUri.Length - (AppIdentityRedirectPath.Length - 1)))), "v2").ToString());
                    if (link is JProperty)
                        serviceLink = ((JObject)(((JProperty)(link)).Value));
                    else
                        serviceLink = ((JObject)(link));
                    serviceLink["name"] = appName;
                    serviceLink["author"] = appReg["author"];
                    count++;
                    if (includeLocal)
                    {
                        var localRedirectUri = Convert.ToString(appReg["local_redirect_uri"]);
                        if (!string.IsNullOrEmpty(localRedirectUri))
                            AddLink((serviceName + "-local"), "GET", links, new Uri(new Uri(localRedirectUri.Substring(0, (localRedirectUri.Length - (AppIdentityRedirectPath.Length - 1)))), "v2").ToString());
                    }
                }
            }
            result["count"] = count;
        }

        public virtual void ExecuteOAuthGetAppsSingleton(JObject schema, JObject payload, JObject result, string error)
        {
            if (string.IsNullOrEmpty(error))
                error = "invalid_path";
            var appReg = App.AppDataReadAllText(OAuth2FileName("apps", payload["client_id"]));
            if (appReg == null)
                RESTfulResource.ThrowError(404, error, "Client application '{0}' is not registered.", payload["client_id"]);
            foreach (var p in TextUtility.ParseYamlOrJson(appReg).Properties())
                result.Add(p);
            if (IsImmutable)
                ExecuteOAuthAppsLinks(result);
        }

        public virtual void ExecuteOAuthDeleteAppsSingleton(JObject schema, JObject payload, JObject result)
        {
            ExecuteOAuthGetAppsSingleton(schema, payload, result, null);
            App.AppDataDelete(OAuth2FileName("apps", payload["client_id"]));
            ExecuteOAuthAppsUpdateCORs(result, result);
            result.RemoveAll();
        }

        public virtual void ExecuteOAuthPatchAppsSingleton(JObject schema, JObject payload, JObject result)
        {
            ExecuteOAuthGetAppsSingleton(schema, payload, result, null);
            var original = result.DeepClone();
            if (payload["name"] != null)
                result["name"] = payload["name"];
            if (payload["author"] != null)
                result["author"] = payload["author"];
            if (payload["client_secret"] != null)
                result["client_secret"] = payload["client_secret"];
            if (payload["redirect_uri"] != null)
                result["redirect_uri"] = payload["redirect_uri"];
            if (payload["local_redirect_uri"] != null)
                result["local_redirect_uri"] = payload["local_redirect_uri"];
            if (payload["authorization"] != null)
            {
                if (result["authorization"] == null)
                    result["authorization"] = payload["authorization"];
                else
                    foreach (var p in ((JObject)(payload["authorization"])).Properties())
                        result["authorization"][p.Name] = p.Value;
            }
            if (payload["trusted"] != null)
                result["trusted"] = payload["trusted"];
            ExecuteOAuthAppsValidate(result);
            App.AppDataWriteAllText(OAuth2FileName("apps", result["client_id"]), result.ToString());
            ExecuteOAuthAppsLinks(result);
            ExecuteOAuthAppsUpdateCORs(result, ((JObject)(original)));
        }

        public virtual void ExecuteOAuthAppsUpdateCORs(JObject appReg, JObject appRegOriginal)
        {
            foreach (var propName in new string[] {
                    "redirect_uri",
                    "local_redirect_uri"})
            {
                var redirectUri = ((string)(appReg[propName]));
                var originalRedirectUri = ((string)(appRegOriginal[propName]));
                // delete the previous CORs entries
                if (!string.IsNullOrEmpty(originalRedirectUri))
                {
                    App.AppDataDelete(string.Format("sys/cors/{0}/{1}.json", TextUtility.ToUrlEncodedToken(UriToCORsOrigin(originalRedirectUri)), appReg["client_id"]));
                    HttpContext.Current.Cache.Remove(("cors_origin_" + UriToCORsOrigin(originalRedirectUri)));
                }
                // create the new CORs entries
                if ((!string.IsNullOrEmpty(redirectUri) && HttpMethod != "DELETE") && (Convert.ToBoolean(appReg.SelectToken("authorization.spa")) || Convert.ToBoolean(appReg.SelectToken("authorization.native"))))
                {
                    var data = new JObject();
                    data["app"] = appReg["name"];
                    data["client_id"] = appReg["client_id"];
                    data["uri"] = redirectUri;
                    data["type"] = propName;
                    data["origin"] = UriToCORsOrigin(redirectUri);
                    App.AppDataWriteAllText(string.Format("sys/cors/{0}/{1}.json", TextUtility.ToUrlEncodedToken(((string)(data["origin"]))), appReg["client_id"]), data.ToString());
                }
            }
        }

        public static string UriToCORsOrigin(string appUri)
        {
            var url = new Uri(appUri);
            var origin = string.Format("{0}://{1}", url.Scheme, url.Host);
            if (url.Port != 80)
                origin = string.Format("{0}:{1}", origin, url.Port);
            return origin;
        }
    }
}
