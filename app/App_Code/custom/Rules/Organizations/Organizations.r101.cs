using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using StefanTutorialDemo.Data;
using StefanTutorialDemo.Models;

namespace StefanTutorialDemo.Rules
{
    public partial class OrganizationsBusinessRules : StefanTutorialDemo.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view after an action
        /// with a command name that matches "Insert".
        /// </summary>
        [Rule("r101")]
        public void r101Implementation(OrganizationsModel instance)
        {
            var user = Membership.CreateUser(instance.OwnerEmail, instance.OwnerPassword, instance.OwnerEmail);
            SqlText.ExecuteNonQuery("UPDATE Users SET OrganizationID = @p0 WHERE UserID = @p1",
                instance.OrganizationID, user.ProviderUserKey);
            Roles.AddUserToRole(instance.OwnerEmail, "Owners");
        }
    }
}
