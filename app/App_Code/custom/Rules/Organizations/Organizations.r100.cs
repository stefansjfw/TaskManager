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
    public partial class OrganizationsBusinessRules : MyCompany.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view before an action
        /// with a command name that matches "Insert".
        /// </summary>
        [Rule("r100")]
        public void r100Implementation(OrganizationsModel instance)
        {
            if (instance.OwnerPassword != instance.OwnerPasswordConfirmation)
            {
                PreventDefault();
                Result.ShowAlert("Password and confirmation do not match!");
            }
            else
            {
                ApplicationMembershipProvider.ValidateUserPassword(instance.OwnerEmail, instance.OwnerPassword);
            }
        }
    }
}
