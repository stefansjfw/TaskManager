using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using MyCompany.Data;
using MyCompany.Models;
using MyCompany.Security;

namespace MyCompany.Rules
{
    public partial class UsersBusinessRules : MyCompany.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view before an action
        /// with a command name that matches "Insert|Update".
        /// </summary>
        [Rule("r100")]
        public void r100Implementation(UsersModel instance)
        {
            if (instance["Password"].Modified && instance.PasswordConfirmation != instance.Password)
            {
                PreventDefault();
                Result.ShowAlert("Password and confirmation do not match!");
            }
            else
            {
                ApplicationMembershipProvider.ValidateUserPassword(instance.UserName, instance.Password);
                instance.Password = ApplicationMembershipProvider.EncodeUserPassword(instance.Password);
                if (!UserIsInRole("Administrators"))
                {
                    instance.OrganizationID = OrganizationID;
                }
            }
        }
    }
}
