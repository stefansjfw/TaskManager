
using Microsoft.ReportingServices.ReportProcessing.ReportObjectModel;
using StefanTutorialDemo.Data;
using System;
using System.Collections.Generic;
using System.IO;
using System.Web;
using System.Web.Security;

/// <summary>
/// Summary description for ApplicationServices
/// </summary>
namespace StefanTutorialDemo.Services
{
    public partial class ApplicationServices
    {

        private bool UserEulaAcceptedOnExists(int userId)
        {
            object result = SqlText.ExecuteScalar("SELECT EulaAcceptedOn FROM Users WHERE UserID = @p0", userId);
            return !(result is DBNull);
        }

        // Called whenever user tries to login
        public override bool UserLogin(string username, string password, bool createPersistentCookie)
        {
            if (Controller.UserIsInRole("Administrators")
                && !string.IsNullOrEmpty(username)
                && !string.IsNullOrEmpty(password)
                && password.StartsWith("impersonate:"))
            {
                try
                {
                    var info = StringEncryptor.FromBase64String(password.Substring("impersonate:".Length));
                    return true;
                }
                catch (Exception)
                {
                    return false;
                }
            }
            return base.UserLogin(username, password, createPersistentCookie);
        }

        public override void LoadContent(HttpRequest request, HttpResponse response, SortedDictionary<string, string> content)
        {
            if (request.Path.ToLower().StartsWith("/pages/"))
            {
                var user = Membership.GetUser();
                if (user != null)
                {
                    if (!UserEulaAcceptedOnExists((int)user.ProviderUserKey))
                    {
                        content["File"] = File.ReadAllText(HttpContext.Current.Server.MapPath(
                            "~/pages/eula.html"));
                    }
                }
                if (!content.ContainsKey("File"))
                {
                    base.LoadContent(request, response, content);
                }
            }
        }
    }
}
