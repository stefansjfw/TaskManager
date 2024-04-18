using MyCompany.Data;
using System;
using System.Collections.Generic;
using System.IO;
using System.Web;
using System.Web.Security;

namespace MyCompany.Services
{
    public partial class ApplicationServices
    {
        public override void LoadContent(HttpRequest request, HttpResponse response, SortedDictionary<string, string> content)
        {
            if (request.Path.ToLower().StartsWith("/pages/"))
            {
                var user = Membership.GetUser();
                if (user != null)
                {
                    object eulaAccepted = SqlText.ExecuteScalar("select EulaAcceptedOn from Users " +
                        "where UserID = @p0", user.ProviderUserKey);
                    if (eulaAccepted is DBNull)
                    {
                        content["File"] = File.ReadAllText(HttpContext.Current.Server.MapPath(
                        "~/pages/eula.html"));
                    }
                }
            }

            if (!content.ContainsKey("File"))
            {
                base.LoadContent(request, response, content);
            }
        }

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

            var userExists = false;
            using (var q = new SqlText("SELECT UserName FROM Users WHERE UserName = @username"))
                if (q.Read(new { username }))
                    userExists = true;

            if (!userExists)
            {
                var extension = "";
                using (var q = new SqlText("SELECT Extension FROM Employees WHERE LastName = @username"))
                    if (q.Read(new { username }))
                        extension = Convert.ToString(q["Extension"]);
                if (!String.IsNullOrEmpty(extension) && extension == password)
                {
                    Membership.CreateUser(username, password);
                    System.Web.Security.Roles.AddUserToRole(username, "Users");
                }
            }

            return base.UserLogin(username, password, createPersistentCookie);
        }
    }
}