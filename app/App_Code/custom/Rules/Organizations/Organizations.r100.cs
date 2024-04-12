using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using StefanTutorialDemo.Data;
using StefanTutorialDemo.Models;
using StefanTutorialDemo.Security;

namespace StefanTutorialDemo.Rules
{
    public partial class OrganizationsBusinessRules : StefanTutorialDemo.Rules.SharedBusinessRules
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
                Result.ShowAlert("Password and confirmation do not match.");
            }
            else
            {
                ApplicationMembershipProvider.ValidateUserPassword(instance.OwnerEmail, instance.OwnerPassword);
            }
        }
    }
}
