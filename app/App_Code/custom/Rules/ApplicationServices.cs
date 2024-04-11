
using StefanTutorialDemo.Data;
using System;

/// <summary>
/// Summary description for ApplicationServices
/// </summary>
namespace StefanTutorialDemo.Services
{
    public partial class ApplicationServices
    {
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
    }
}
