using System;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.ComponentModel;
using System.Data;
using System.Data.Common;
using System.Configuration;
using System.IO;
using System.Globalization;
using System.Linq;
using System.Net;
using System.Net.Mail;
using System.Reflection;
using System.Threading;
using System.Security.Principal;
using System.Text;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Caching;
using System.Web.UI;
using System.Web.UI.HtmlControls;
using System.Web.Security;
using System.Web.SessionState;
using System.Web.Configuration;
using System.IO.Compression;
using System.Xml.XPath;
using System.Web.Routing;
using System.Drawing;
using System.Drawing.Imaging;
using System.Security.Cryptography;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;
using MyCompany.Data;
using MyCompany.Handlers;
using MyCompany.Services.Rest;
using MyCompany.Web;

namespace MyCompany.Services
{
    public class UserTicket
    {

        [JsonProperty("name")]
        public string UserName;

        [JsonProperty("email")]
        public string Email;

        [JsonProperty("access_token")]
        public string AccessToken;

        [JsonProperty("refresh_token")]
        public string RefreshToken;

        [JsonProperty("picture")]
        public string Picture;

        [JsonProperty("claims")]
        public Dictionary<string, object> Claims = new Dictionary<string, object>();

        public UserTicket()
        {
        }

        public UserTicket(MembershipUser user)
        {
            UserName = user.UserName;
            Email = user.Email;
            Picture = ApplicationServices.Create().UserPictureString(user);
        }

        public UserTicket(MembershipUser user, string accessToken, string refreshToken) :
                this(user)
        {
            this.AccessToken = accessToken;
            this.RefreshToken = refreshToken;
        }
    }

    public partial class ApplicationServicesBase
    {

        public virtual int GetAccessTokenDuration(string fromSettings)
        {
            // 15 minutes
            var accessDuration = 15;
            JToken jTimeout = null;
            if (!string.IsNullOrEmpty(fromSettings))
            {
                jTimeout = TryGetJsonProperty(DefaultSettings, fromSettings);
                if (jTimeout != null)
                    accessDuration = ((int)(jTimeout));
            }
            return accessDuration;
        }

        public virtual int GetRefreshTokenDuration(string fromSettings)
        {
            return GetRefreshTokenDuration(fromSettings, 7);
        }

        public virtual int GetRefreshTokenDuration(string fromSettings, int defaultValue)
        {
            // 60 minutes x 24 hours x 7 days = 10080 minutes
            var refreshDuration = ((60 * 24) * defaultValue);
            JToken jTimeout = null;
            if (!string.IsNullOrEmpty(fromSettings))
            {
                jTimeout = TryGetJsonProperty(DefaultSettings, fromSettings);
                if (jTimeout != null)
                    refreshDuration = ((int)(jTimeout));
            }
            return refreshDuration;
        }

        public virtual UserTicket CreateTicket(MembershipUser user, string refreshToken)
        {
            return CreateTicket(user, refreshToken, "membership.accountManager.accessTokenDuration", "membership.accountManager.refreshTokenDuration");
        }

        public virtual UserTicket CreateTicket(MembershipUser user, string refreshToken, string accessTokenDuration, string refreshTokenDuration)
        {
            return CreateTicket(user, refreshToken, GetAccessTokenDuration(accessTokenDuration), GetRefreshTokenDuration(refreshTokenDuration));
        }

        public virtual UserTicket CreateTicket(MembershipUser user, string refreshToken, int accessTokenDuration, int refreshTokenDuration)
        {
            var userData = string.Empty;
            var accessTicket = new FormsAuthenticationTicket(1, user.UserName, DateTime.Now, DateTime.Now.AddMinutes(accessTokenDuration), false, userData);
            if (string.IsNullOrEmpty(refreshToken))
            {
                var refreshTicket = new FormsAuthenticationTicket(1, user.UserName, DateTime.Now, DateTime.Now.AddMinutes(refreshTokenDuration), false, "REFRESHONLY");
                refreshToken = FormsAuthentication.Encrypt(refreshTicket);
            }
            var ticket = new UserTicket(user, FormsAuthentication.Encrypt(accessTicket), refreshToken);
            return ticket;
        }

        public virtual bool ValidateTicket(FormsAuthenticationTicket ticket)
        {
            return !(((ticket == null) || (ticket.Expired || string.IsNullOrEmpty(ticket.Name))));
        }

        public virtual void InvalidateTicket(FormsAuthenticationTicket ticket)
        {
        }

        public virtual bool ValidateToken(string accessToken)
        {
            try
            {
                if (!RESTfulResource.AccessTokenToSelfEncryptedToken(accessToken, out accessToken))
                {
                    var user = AccessTokenToAppIdentityUser(accessToken);
                    if (user != null)
                    {
                        HttpContext.Current.User = new RolePrincipal(new FormsIdentity(new FormsAuthenticationTicket(user.UserName, false, 0)));
                        return true;
                    }
                    return false;
                }
                var ticket = FormsAuthentication.Decrypt(accessToken);
                if (ticket.UserData == "REFRESHONLY")
                    return false;
                if (ValidateTicket(ticket))
                {
                    HttpContext.Current.User = new RolePrincipal(new FormsIdentity(new FormsAuthenticationTicket(ticket.Name, false, 0)));
                    return true;
                }
            }
            catch (Exception)
            {
            }
            return false;
        }

        public virtual MembershipUser AccessTokenToAppIdentityUser(string accessToken)
        {
            return null;
        }

        public virtual bool UserLogin(string username, string password, bool createPersistentCookie)
        {
            if (Convert.ToBoolean(SettingsProperty("server.2FA.enabled", true)) && Convert.ToBoolean(SettingsProperty("server.2FA.disableLoginPassword", false)))
            {
                var user = Membership.GetUser(username);
                if ((user == null) || user.IsLockedOut)
                    return false;
                var userAuthData = UserAuthenticationData(username);
                if (((userAuthData == null) || (userAuthData["2FA"] == null)) && Convert.ToString(SettingsProperty("server.2FA.setup.mode")) != "auto")
                    return false;
                return true;
            }
            else
            {
                if (Membership.ValidateUser(username, password))
                    return true;
                else
                    return false;
            }
        }

        protected virtual int OtpAuthenticationDurationOfTrust()
        {
            return Convert.ToInt32(SettingsProperty("server.2FA.trustThisDevice", 180));
        }

        public virtual void UserLogout()
        {
            FormsAuthentication.SignOut();
        }

        public virtual string[] UserRoles()
        {
            return Roles.GetRolesForUser();
        }

        public virtual object AuthenticateUser(string username, string password, System.Boolean? createPersistentCookie)
        {
            var response = HttpContext.Current.Response;
            if (password.StartsWith("token:"))
            {
                // validate token login
                try
                {
                    var key = password.Substring(6);
                    var ticket = FormsAuthentication.Decrypt(key);
                    if (ValidateTicket(ticket) && (!string.IsNullOrEmpty(ticket.UserData) && Regex.IsMatch(ticket.UserData, "^(REFRESHONLY$|OAUTH:)")))
                    {
                        var user = Membership.GetUser(ticket.Name);
                        if ((user != null) && (user.IsApproved && !user.IsLockedOut))
                        {
                            if (!ApplicationServices.AllowUI(user.UserName))
                                return false;
                            InvalidateTicket(ticket);
                            if (createPersistentCookie.HasValue)
                                return CreateTicket(user, key);
                            else
                                return CreateTicket(user, key, "server.rest.authorization.accessTokenDuration", "server.rest.authorization.refreshTokenDuration");
                        }
                    }
                }
                catch (Exception)
                {
                }
            }
            else
            {
                if (Regex.IsMatch(password, ";otpauth\\:\\w+;exec\\:\\w+\\;"))
                    return OtpAuth(username, password);
                else
                {
                    // login user
                    if (UserLogin(username, password, createPersistentCookie.Equals(true)))
                    {
                        var successResponse = CreateUserLoginResponse(username, true);
                        if ((successResponse != null) && AllowUserLoginResponse(username, password, successResponse))
                            return successResponse;
                        // create a cookie to keep track of the user identity for the app pages
                        if (createPersistentCookie.HasValue)
                            FormsAuthentication.SetAuthCookie(username, createPersistentCookie.Value);
                        var user = Membership.GetUser(username);
                        if (user != null)
                        {
                            if (createPersistentCookie.HasValue)
                                return CreateTicket(user, null);
                            else
                                return CreateTicket(user, null, "server.rest.authorization.accessTokenDuration", "server.rest.authorization.refreshTokenDuration");
                        }
                    }
                    else
                    {
                        var failureResponse = CreateUserLoginResponse(username, false);
                        if (failureResponse != null)
                            return failureResponse;
                    }
                }
            }
            return false;
        }

        protected virtual void SkipUserLoginResponse()
        {
            HttpContext.Current.Items["ApplicationServices_SkipUserLoginResponse"] = true;
        }

        protected virtual object OtpAuth(string username, string password)
        {
            var totpSize = Convert.ToInt32(SettingsProperty("server.2FA.code.length", 6));
            var totpPeriod = Convert.ToInt32(SettingsProperty("server.2FA.code.period", 30));
            var backupCodeLength = Convert.ToInt32(SettingsProperty("server.2FA.backupCodes.length", 8));
            var backupCodeCount = Convert.ToInt32(SettingsProperty("server.2FA.backupCodes.count", 10));
            // prepare the otpauth arguments
            var args = new JObject(new JProperty("username", username));
            password = ("password:" + password);
            foreach (var vp in password.Split(';'))
            {
                var p = Regex.Match(vp, "^(\\w+)\\:(.+)$");
                if (p.Success)
                {
                    var v = p.Groups[2].Value;
                    object o = v;
                    if (v == "null")
                        o = null;
                    else
                    {
                        if ((v == "true") || (v == "false"))
                            o = Convert.ToBoolean(v);
                    }
                    var propName = p.Groups[1].Value;
                    args.Remove(propName);
                    args.Add(new JProperty(propName, o));
                }
            }
            password = Convert.ToString(args["password"]);
            var validationKey = ApplicationServices.ValidationKey;
            // execute the otpauth method
            var exec = Convert.ToString(args["exec"]);
            var result = new JObject();
            // ***** send verification code to the user *****
            if (exec == "send")
            {
                result["event"] = "otpauthtotpsetup_verificationcodesent.app";
                var method = Convert.ToString(args["method"]);
                var type = Convert.ToString(args["type"]);
                try
                {
                    var authData = OtpAuthenticationData(username, Convert.ToString(args["url"]));
                    var contacts = authData["verify"][type];
                    if (!((contacts is JArray)))
                        contacts = new JArray(contacts);
                    foreach (var c in contacts)
                    {
                        var contact = Convert.ToString(c);
                        if (TextUtility.Hash(contact) == method)
                        {
                            var secret = OtpAuthenticationSecretFrom(authData["otpauth"]);
                            var code = new Totp(TextUtility.FromBase32String(secret), totpPeriod).Compute(DateTime.UtcNow.AddSeconds(totpPeriod), totpSize);
                            var message = string.Format(Regex.Replace(Convert.ToString(args["template"]), "\\d{5,}", "{0}"), code);
                            var confirmation = Convert.ToString(args["confirmation"]);
                            result["notify"] = OtpAuthenticationSendVerificationCode(code, type, contact, message, confirmation);
                            break;
                        }
                    }
                }
                catch (Exception ex)
                {
                    result["notify"] = ex.Message;
                }
            }
            // ***** validate the verification code *****
            if (exec == "login")
            {
                var authData = OtpAuthenticationData(username, Convert.ToString(args["url"]));
                var otpauthUrl = authData["otpauth"];
                var passcode = Convert.ToString(args["passcode"]);
                if ((otpauthUrl != null) && !string.IsNullOrEmpty(passcode))
                {
                    var secret = OtpAuthenticationSecretFrom(otpauthUrl);
                    var user = Membership.GetUser(username);
                    if (!string.IsNullOrEmpty(secret) && ((user != null) && !user.IsLockedOut))
                    {
                        var d = DateTime.UtcNow;
                        var maxDate = d.AddSeconds(120);
                        d = d.AddSeconds(((-1 * Math.Max(totpPeriod, Convert.ToInt32(SettingsProperty("server.2FA.code.window", 180)))) - totpPeriod));
                        var authenticated = false;
                        while (d < maxDate)
                        {
                            var code = new Totp(TextUtility.FromBase32String(secret), totpPeriod).Compute(d, totpSize);
                            if (code == passcode)
                            {
                                authenticated = true;
                                break;
                            }
                            d = d.AddSeconds(totpPeriod);
                        }
                        if (!authenticated)
                        {
                            var backupCodes = new List<string>(Regex.Split(Convert.ToString(authData["backupCodes"]), "\\s*,\\s*"));
                            if (backupCodes.Contains(passcode))
                            {
                                authenticated = true;
                                backupCodes.Remove(passcode);
                                var newBackupCodes = string.Join(", ", backupCodes.ToArray());
                                if (string.IsNullOrEmpty(newBackupCodes))
                                    newBackupCodes = null;
                                UserAuthenticationData(username, new JObject(new JProperty("Backup Codes", newBackupCodes)));
                            }
                        }
                        if (authenticated)
                        {
                            // internal verification has been completed successfully
                            if (string.IsNullOrEmpty(password) && (HttpContext.Current.User.Identity.Name == username))
                                return true;
                            if (Convert.ToBoolean(args["trustThisDevice"]))
                                OtpAuthenticationTrustThisDevice(username, authData);
                            // return the user ticket to the client
                            SkipUserLoginResponse();
                            return AuthenticateUser(username, Convert.ToString(args["password"]), Convert.ToBoolean(args["createPersistentCookie"]));
                        }
                        else
                            Membership.ValidateUser(username, new Guid().ToString());
                    }
                }
                return false;
            }
            // ***** generate the new backup codes *****
            if (exec == "generate")
            {
                var secret = OtpAuthenticationSecretFrom(args["url"]);
                if (secret != null)
                {
                    result["event"] = "otpauthtotpsetup_backupcodesgeneratedone.app";
                    var backupCodes = new List<string>();
                    result.Add(new JProperty("newBackupCodes", new Totp(secret, totpPeriod).Compute(backupCodeLength, backupCodeCount)));
                }
                else
                    return false;
            }
            // ***** setup the 2-Factor Authentication *****
            if (exec == "setup")
            {
                var passcode = Convert.ToString(args["passcode"]);
                if (!string.IsNullOrEmpty(password))
                {
                    // new 2FA setup
                    var userAuthData = UserAuthenticationData(username);
                    if ((userAuthData != null) && (userAuthData["2FA"] != null))
                        return false;
                    SkipUserLoginResponse();
                    if ((password == validationKey) || UserLogin(username, password, false))
                    {
                        result["event"] = "otpauthtotpsetup.app";
                        result["otpauth"] = "totp";
                        result["username"] = username;
                        var secret = TextUtility.ToBase32String(TextUtility.GetUniqueKey(Convert.ToInt32(SettingsProperty("server.2FA.secret.length", 10))));
                        result["secret"] = secret;
                        result["url"] = string.Format("otpauth://totp/{0}?secret={1}&issuer={2}&algorithm=SHA1&digits={3}&period={4}", HttpUtility.UrlEncode(username), secret, HttpUtility.UrlEncode(Convert.ToString(SettingsProperty("appName", Name))), totpSize, totpPeriod);
                        result.Add(new JProperty("backupCodes", new Totp(TextUtility.ToBase32String(secret), totpPeriod).Compute(backupCodeLength, backupCodeCount)));
                    }
                    else
                        return false;
                }
                else
                {
                    if (!string.IsNullOrEmpty(passcode))
                    {
                        // existing or new 2FA setup
                        var newUrl = Convert.ToString(args["url"]);
                        var newBackupCodes = Convert.ToString(args["backupCodes"]);
                        object authenticated = (passcode == validationKey);
                        if (!true.Equals(authenticated))
                            authenticated = OtpAuth(username, string.Format("null;exec:login;passcode:{0};url:{1};backupCodes:{2}", passcode, newUrl, newBackupCodes));
                        if (true.Equals(authenticated))
                        {
                            if (!string.IsNullOrEmpty(newUrl))
                            {
                                // save the new or change the existing 2FA setup
                                string existingUrl = null;
                                var userAuthData = UserAuthenticationData(username);
                                if (userAuthData != null)
                                    existingUrl = Convert.ToString(userAuthData["2FA"]);
                                var setupType = "new";
                                // if there is an existing 2FA setup then it must match the new setup
                                if (!string.IsNullOrEmpty(existingUrl))
                                {
                                    if (newUrl != existingUrl)
                                        return false;
                                    setupType = "existing";
                                }
                                // save the setup to the database
                                var newUserAuthData = new JObject();
                                newUserAuthData["2FA"] = newUrl;
                                if (!string.IsNullOrEmpty(newBackupCodes))
                                    newUserAuthData["Backup Codes"] = newBackupCodes;
                                newUserAuthData["Methods"] = args["methods"];
                                UserAuthenticationData(username, newUserAuthData);
                                // inform the user about successful setup
                                result["event"] = "otpauthtotpsetup_complete.app";
                                result["setupType"] = setupType;
                            }
                            else
                            {
                                // existing 2FA setup
                                var userAuthData = UserAuthenticationData(username);
                                var secret = OtpAuthenticationSecretFrom(userAuthData["2FA"]);
                                if (secret != null)
                                {
                                    result["event"] = "otpauthtotpsetup.app";
                                    result["otpauth"] = "totp";
                                    result["username"] = username;
                                    result.Add(new JProperty("url", userAuthData["2FA"]));
                                    result.Add(new JProperty("secret", secret));
                                    result.Add(new JProperty("backupCodes", Regex.Split(Convert.ToString(userAuthData["Backup Codes"]), "\\s*,\\s*")));
                                    var methods = Convert.ToString(userAuthData["Methods"]);
                                    if (string.IsNullOrEmpty(methods))
                                        methods = "app,email";
                                    methods = Regex.Replace(methods.ToLower(), "\\s+", string.Empty);
                                    result.Add(new JProperty("methods", methods));
                                    result.Add(new JProperty("status", "ready"));
                                }
                                else
                                    return false;
                            }
                        }
                        else
                            return false;
                    }
                }
                if (result["event"] == null)
                {
                    result["event"] = "otpauthtotpsetup_confirm.app";
                    JObject userAuthData = null;
                    var newUrl = Convert.ToString(args["url"]);
                    var newBackupCodes = Convert.ToString(args["backupCodes"]);
                    var newMethods = Convert.ToString(args["methods"]);
                    if (!string.IsNullOrEmpty(newUrl))
                    {
                        userAuthData = new JObject();
                        userAuthData["2FA"] = newUrl;
                        userAuthData["Backup Codes"] = newBackupCodes;
                        userAuthData["Methods"] = newMethods;
                    }
                    var authData = CreateUserLoginResponse(username, true, userAuthData);
                    // options "url" and "backupCodes" are provided by the setup when Enable/Save is pressed
                    if (authData == null)
                        authData = new JObject(new JProperty("otpauth", newUrl));
                    var otpauthUrl = Convert.ToString(authData["otpauth"]);
                    if (Convert.ToString(args["consent"]) != "Enable" && !string.IsNullOrEmpty(newUrl))
                    {
                        // do not remove 2FA if the client URL does not match the 2FA option in the User Authorization Data
                        userAuthData = UserAuthenticationData(username);
                        if ((userAuthData != null) && newUrl != Convert.ToString(userAuthData["2FA"]))
                            return false;
                        // remove 2FA setup
                        UserAuthenticationData(username, new JObject(new JProperty("2FA", null), new JProperty("Backup Codes", null), new JProperty("Methods", null)));
                        result["event"] = "otpauthtotpsetup_complete.app";
                        result["setupType"] = "none";
                    }
                    else
                    {
                        if (!string.IsNullOrEmpty(otpauthUrl))
                        {
                            // ask the user to provide the verification code
                            result["confirm"] = "verification_code";
                            authData["canTrustThisDevice"] = false;
                            if (!string.IsNullOrEmpty(newUrl))
                            {
                                authData["url"] = newUrl;
                                authData["canEnterBackupCode"] = false;
                            }
                            if (!string.IsNullOrEmpty(newBackupCodes))
                                authData["backupCodes"] = newBackupCodes;
                            if (!string.IsNullOrEmpty(newMethods))
                                authData["methods"] = newMethods;
                        }
                        else
                        {
                            result["confirm"] = "password";
                            authData["otpauth"] = "totp";
                            authData["username"] = username;
                        }
                        authData["exec"] = "setup";
                        authData["verifyVia"] = SettingsProperty("server.2FA.verify", new JObject(new JProperty("app", true), new JProperty("email", true)));
                        if (authData["verifyVia"]["app"] == null)
                            authData["verifyVia"]["app"] = true;
                        if (authData["verifyVia"]["email"] == null)
                            authData["verifyVia"]["email"] = true;
                        var setup = SettingsProperty("server.2FA.setup");
                        if (setup != null)
                            authData["setup"] = setup;
                        result["options"] = authData;
                        authData["confirm"] = result["confirm"];
                    }
                }
            }
            return result;
        }

        protected virtual string OtpAuthenticationSendVerificationCode(string code, string type, string contact, string message, string confirmation)
        {
            if (type == "email")
            {
                var mail = new MailMessage()
                {
                    Subject = message,
                    Body = code
                };
                mail.To.Add(new MailAddress(contact));
                var client = new SmtpClient();
                client.Send(mail);
            }
            return confirmation;
        }

        protected virtual bool OtpAuthenticationTrustThisDevice(string username, JObject authData)
        {
            var result = false;
            try
            {
                var userTrust = new SortedDictionary<string, string>();
                var cookie = HttpContext.Current.Request.Cookies[".trustThis"];
                if (cookie != null)
                {
                    // Sample: 05343490152021-09-16T08:22:44.0435998Zadmin
                    // enumerate existing trusts
                    var s = StringEncryptor.FromBase64String(cookie.Value);
                    var iterator = Regex.Match(s, "(?'Passcode'\\d{10})(?'Date'\\d{4}-\\d{2}-\\d{2}T\\d{2}\\:\\d{2}\\:\\d{2}\\.\\d{7}Z)(?'UserName'.+?)(\\s|$)");
                    while (iterator.Success)
                    {
                        userTrust[iterator.Groups["UserName"].Value] = (iterator.Groups["Passcode"].Value + iterator.Groups["Date"].Value);
                        iterator = iterator.NextMatch();
                    }
                }
                if (authData == null)
                {
                    string trustInfo = null;
                    authData = OtpAuthenticationData(username);
                    if ((authData != null) && userTrust.TryGetValue(username, out trustInfo))
                    {
                        var passcode = trustInfo.Substring(0, 10);
                        var d = DateTime.Parse(trustInfo.Substring(10));
                        var secret = OtpAuthenticationSecretFrom(authData["otpauth"]);
                        var expectedPasscode = new Totp(TextUtility.FromBase32String(secret), 30).Compute(d.ToUniversalTime(), 10);
                        if (passcode == expectedPasscode)
                            result = true;
                        else
                            userTrust.Remove(username);
                    }
                }
                else
                {
                    // create a trust entry
                    var secret = OtpAuthenticationSecretFrom(authData["otpauth"]);
                    if (!string.IsNullOrEmpty(secret))
                    {
                        var d = DateTime.UtcNow;
                        var passcode = new Totp(TextUtility.FromBase32String(secret), 30).Compute(d, 10);
                        userTrust[username] = string.Format("{0}{1:o}", passcode, d);
                    }
                }
                // set the .trustThis cookie
                if (userTrust.Count > 0)
                {
                    var list = new List<string>();
                    foreach (string name in userTrust.Keys)
                        list.Add((userTrust[name] + name));
                    var newTrust = StringEncryptor.ToBase64String(string.Join("\\n", list.ToArray()));
                    if ((cookie == null) || cookie.Value != newTrust)
                        ApplicationServices.SetCookie(".trustThis", newTrust, DateTime.Now.AddDays(OtpAuthenticationDurationOfTrust()));
                }
                else
                {
                    if (cookie != null)
                    {
                        cookie.Expires = DateTime.Now.AddDays(-10);
                        cookie.Value = null;
                        ApplicationServices.SetCookie(cookie);
                    }
                }
            }
            catch (Exception)
            {
                // ignore all exceptions
            }
            return result;
        }

        protected virtual string OtpAuthenticationSecretFrom(JToken url)
        {
            return OtpAuthenticationSecretFrom(Convert.ToString(url));
        }

        protected virtual string OtpAuthenticationSecretFrom(string url)
        {
            var secretParam = Regex.Match(Convert.ToString(url), "(\\?|&)secret=(?'Secret'.+?)(&|$)");
            if (secretParam.Success)
                return secretParam.Groups["Secret"].Value;
            return null;
        }

        protected virtual JObject CreateUserLoginResponse(string username, bool success)
        {
            return CreateUserLoginResponse(username, success, null);
        }

        protected virtual JObject CreateUserLoginResponse(string username, bool success, JObject userAuthData)
        {
            if (success)
            {
                if (HttpContext.Current.Items.Contains("ApplicationServices_SkipUserLoginResponse"))
                    HttpContext.Current.Items.Remove("ApplicationServices_SkipUserLoginResponse");
                else
                {
                    if (userAuthData == null)
                        OtpAuthenticationActivate(username);
                    var authData = OtpAuthenticationData(username, userAuthData);
                    if (authData["otpauth"] != null)
                    {
                        authData["event"] = "otpauth.app";
                        authData["username"] = username;
                        authData["success"] = success;
                        authData["otpauth"] = authData["type"];
                        authData["confirm"] = "verification_code";
                        var verify = authData["verify"];
                        if (verify != null)
                        {
                            var callMe = verify["call"];
                            if (callMe != null)
                                verify["call"] = EncodeContactInformation(callMe, "call");
                            var smsMe = verify["sms"];
                            if (smsMe != null)
                                verify["sms"] = EncodeContactInformation(smsMe, "sms");
                            var emailMe = verify["email"];
                            if (emailMe != null)
                                verify["email"] = EncodeContactInformation(emailMe, "email");
                            var dialTo = verify["dial"];
                            if (dialTo != null)
                                verify["dial"] = EncodeContactInformation(dialTo, "dial");
                        }
                        if (OtpAuthenticationDurationOfTrust() == 0)
                            authData["canTrustThisDevice"] = false;
                        // remove sensitive data
                        authData.Remove("type");
                        authData.Remove("backupCodes");
                        return authData;
                    }
                }
            }
            return null;
        }

        protected virtual void OtpAuthenticationActivate(string username)
        {
            if (Convert.ToBoolean(SettingsProperty("server.2FA.enabled", true)) && (Convert.ToString(SettingsProperty("server.2FA.setup.mode", "user")) == "auto"))
                try
                {
                    var userAuthData = UserAuthenticationData(username);
                    if ((userAuthData == null) || ((userAuthData["Source"] == null) && (userAuthData["2FA"] == null)))
                    {
                        // get the 2FA setup data
                        var setupObject = OtpAuth(username, string.Format("null;otpauth:totp;exec:setup;password:{0};", ApplicationServices.ValidationKey));
                        if ((setupObject != null) && (setupObject is JObject))
                        {
                            // enumerate the verification methods
                            var setupMethods = SettingsProperty("server.2FA.setup.methods");
                            var methods = new List<string>();
                            if (setupMethods != null)
                            {
                                if (setupMethods["email"] == null)
                                    setupMethods["email"] = true;
                                foreach (JProperty p in setupMethods)
                                    if (((p.Type == JTokenType.Property) && (p.Value.Type == JTokenType.Boolean)) && Convert.ToBoolean(p.Value))
                                        methods.Add(p.Name);
                            }
                            if (methods.Count == 0)
                                methods.Add("email");
                            // save the 2FA setup data
                            var setupData = ((JObject)(setupObject));
                            var backupCodes = ((JArray)(setupData["backupCodes"]));
                            if (backupCodes == null)
                                backupCodes = new JArray();
                            OtpAuth(username, string.Format("null;otpauth:totp;exec:setup;passcode:{0};trustThisDevice:false;url:{1};backupCodes:{2};methods:{3};", ApplicationServices.ValidationKey, setupData["url"], string.Join(", ", backupCodes), string.Join(",", methods.ToArray())));
                        }
                    }
                }
                catch (Exception)
                {
                    // ignore all errors
                }
        }

        protected virtual bool AllowUserLoginResponse(string username, string password, JObject response)
        {
            if (Convert.ToString(response["event"]) == "otpauth.app")
            {
                if (OtpAuthenticationTrustThisDevice(username, null))
                    return false;
            }
            return true;
        }

        public static JToken EncodeContactInformation(JToken contacts, string type)
        {
            if (!((contacts is JArray)))
                contacts = new JArray(contacts);
            for (var i = 0; (i < contacts.Count()); i++)
            {
                var text = Convert.ToString(contacts[i]);
                var encodedContact = new JObject(new JProperty("value", TextUtility.Hash(text)), new JProperty("type", type));
                contacts[i] = encodedContact;
                if ((type == "call") || (type == "sms"))
                {
                    var phone = Regex.Match(text, "^(.+?)(.{4})$");
                    if (phone.Success)
                        text = (Regex.Replace(phone.Groups[1].Value, "\\d", "x") + phone.Groups[2].Value);
                }
                else
                {
                    if (type == "email")
                    {
                        var email = Regex.Match(text, "^(.)(.+?)(.@.+)$");
                        if (email.Success)
                            text = ((email.Groups[1].Value + "...") + email.Groups[3].Value);
                    }
                }
                encodedContact.Add(new JProperty("text", text));
            }
            return contacts;
        }

        protected virtual JObject UserAuthenticationData(string username)
        {
            return UserAuthenticationData(username, null);
        }

        protected virtual JObject UserAuthenticationData(string username, JObject newData)
        {
            JObject data = null;
            var user = Membership.GetUser(username);
            if (user != null)
            {
                data = TextUtility.ParseYamlOrJson(ReadUserAuthenticationData(user));
                if (newData != null)
                {
                    if (data == null)
                        data = newData;
                    else
                        foreach (JProperty p in newData.Properties())
                            if (p.Value.Type != JTokenType.Null)
                                data[p.Name] = Convert.ToString(p.Value);
                            else
                                data.Remove(p.Name);
                    data.Remove("error");
                    WriteUserAuthenticationData(user, TextUtility.ToYamlString(data));
                }
            }
            return data;
        }

        protected virtual string ReadUserAuthenticationData(MembershipUser user)
        {
            return user.Comment;
        }

        protected virtual void WriteUserAuthenticationData(MembershipUser user, string data)
        {
            user.Comment = data;
            Membership.UpdateUser(user);
        }

        public virtual void AppDataWriteAllBytes(string path, byte[] data)
        {
            if (IsSiteContentEnabled)
                SiteContentFile.WriteAllBytes(path, MimeMapping.GetMimeMapping(path), data);
        }

        public virtual void AppDataWriteAllText(string path, string data)
        {
            if (IsSiteContentEnabled)
                SiteContentFile.WriteAllText(path, MimeMapping.GetMimeMapping(path), data);
        }

        public virtual string[] AppDataSearch(string path, string filename)
        {
            return AppDataSearch(path, filename, Int32.MaxValue);
        }

        public virtual string[] AppDataSearch(string path, string filename, int maxCount)
        {
            return AppDataSearch(path, filename, maxCount, null);
        }

        public virtual string[] AppDataSearch(string path, string filename, int maxCount, DateTime? modified)
        {
            var files = new List<string>();
            if (IsSiteContentEnabled)
                foreach (var f in ReadSiteContent(path, filename, maxCount, modified))
                    files.Add(f.FullName);
            return files.ToArray();
        }

        public virtual byte[] AppDataReadAllBytes(string path)
        {
            if (IsSiteContentEnabled)
                return SiteContentFile.ReadAllBytes(path);
            return null;
        }

        public virtual string AppDataReadAllText(string path)
        {
            if (IsSiteContentEnabled)
                return SiteContentFile.ReadAllText(path);
            return null;
        }

        public virtual int AppDataDelete(string path)
        {
            if (IsSiteContentEnabled)
                return SiteContentFile.Delete(path);
            return 0;
        }

        public virtual bool AppDataExists(string path)
        {
            if (IsSiteContentEnabled)
                return SiteContentFile.Exists(path);
            return false;
        }

        protected virtual JObject OtpAuthenticationData(string username)
        {
            return OtpAuthenticationData(username, ((JObject)(null)));
        }

        protected virtual JObject OtpAuthenticationData(string username, string otpauthUrl)
        {
            JObject userAuthData = null;
            if (!string.IsNullOrEmpty(otpauthUrl))
            {
                userAuthData = new JObject();
                userAuthData["2FA"] = otpauthUrl;
            }
            return OtpAuthenticationData(username, userAuthData);
        }

        protected virtual JObject OtpAuthenticationData(string username, JObject userAuthData)
        {
            var otpData = new JObject();
            if (userAuthData == null)
                userAuthData = UserAuthenticationData(username);
            if ((userAuthData != null) && Convert.ToBoolean(SettingsProperty("server.2FA.enabled", true)))
            {
                var otpauth = Convert.ToString(userAuthData["2FA"]);
                if (!string.IsNullOrEmpty(otpauth))
                {
                    var otpAuthType = Regex.Match(otpauth, "(^|\\n)otpauth://(\\w+)/");
                    if (otpAuthType.Success)
                    {
                        otpData["otpauth"] = otpauth;
                        otpData["codeLength"] = SettingsProperty("server.2FA.code.length", 6);
                        if (Convert.ToInt32(SettingsProperty("server.2FA.backupCodes.count", 10)) > 0)
                        {
                            var backupCodes = Convert.ToString(userAuthData["Backup Codes"]);
                            otpData["backupCodes"] = backupCodes;
                        }
                        otpData["type"] = otpAuthType.Groups[2].Value;
                        // Verification methods must be enabled in the app and selected by the user during the setup.
                        var verify = new JObject();
                        otpData["verify"] = verify;
                        OtpVerificationData(username, verify);
                        var allowedMethods = new List<string>();
                        var methodsToRemove = new List<string>();
                        // application-approved methods
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.app", true)))
                            allowedMethods.Add("app");
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.email", true)))
                            allowedMethods.Add("email");
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.call", false)))
                            allowedMethods.Add("call");
                        if (Convert.ToBoolean(SettingsProperty("server.2FA.verify.sms", false)))
                            allowedMethods.Add("sms");
                        // user-approved methods
                        var methods = Convert.ToString(userAuthData["Methods"]);
                        if (!string.IsNullOrEmpty(methods))
                        {
                            var userApprovedMethods = Regex.Split(methods, "\\s*,\\s*");
                            foreach (var m in allowedMethods)
                                if (!userApprovedMethods.Contains(m))
                                    methodsToRemove.Add(m);
                            if (allowedMethods.Count > methodsToRemove.Count)
                                foreach (var m in methodsToRemove)
                                    allowedMethods.Remove(m);
                        }
                        // keep the allowed verification methods
                        methodsToRemove.Clear();
                        foreach (var p in verify.Properties())
                            if (!allowedMethods.Contains(p.Name))
                                methodsToRemove.Add(p.Name);
                        foreach (var m in methodsToRemove)
                            verify.Remove(m);
                        // add "dial" method of verification unconditionally
                        var dial = SettingsProperty("server.2FA.verify.dial");
                        if (dial != null)
                            verify["dial"] = dial;
                    }
                }
            }
            return otpData;
        }

        protected virtual void OtpVerificationData(string username, JObject verify)
        {
            verify["app"] = true;
            var user = Membership.GetUser(username);
            if ((user != null) && !string.IsNullOrEmpty(user.Email))
                verify["email"] = user.Email;
        }

        public virtual bool ValidateRESTfulApiKey(HttpApplication app)
        {
            // authenticate the user with the API key specified in the header or query
            var isPublicKey = false;
            var isPathKey = false;
            var apiKey = app.Request.Headers["x-api-key"];
            if (string.IsNullOrEmpty(apiKey))
            {
                apiKey = app.Request.QueryString["x-api-key"];
                isPublicKey = true;
            }
            if (string.IsNullOrEmpty(apiKey))
            {
                apiKey = app.Request.QueryString["api_key"];
                isPublicKey = true;
            }
            var authorizationKeys = ((JArray)(SettingsProperty("server.rest.authorization.keys")));
            if (authorizationKeys != null)
            {
                if (string.IsNullOrEmpty(apiKey))
                {
                    var executionPath = app.Request.CurrentExecutionFilePath;
                    foreach (var key in authorizationKeys)
                        if (key.Type == JTokenType.Object)
                        {
                            var k = Convert.ToString(key["key"]);
                            if ((executionPath == ("/v2/" + k)) || executionPath.StartsWith(string.Format("/v2/{0}/", k)))
                            {
                                apiKey = k;
                                isPublicKey = true;
                                isPathKey = true;
                                break;
                            }
                        }
                }
                if (!string.IsNullOrEmpty(apiKey))
                    foreach (var keyUser in authorizationKeys)
                        if (apiKey.Equals(Convert.ToString(keyUser["key"])))
                        {
                            var username = Convert.ToString(keyUser["user"]);
                            if (!string.IsNullOrEmpty(username))
                            {
                                var user = Membership.GetUser(username);
                                if (user != null)
                                {
                                    if (isPublicKey)
                                        RESTfulResource.PublicApiKey = apiKey;
                                    if (isPathKey)
                                        RESTfulResource.PublicApiKeyInPath = apiKey;
                                    app.Context.User = new RolePrincipal(new FormsIdentity(new FormsAuthenticationTicket(user.UserName, false, 10)));
                                    return true;
                                }
                            }
                        }
            }
            return false;
        }

        public virtual void EnumerateIdClaims(MembershipUser user, JObject claims, List<string> scopes, JObject context)
        {
        }
    }
}
