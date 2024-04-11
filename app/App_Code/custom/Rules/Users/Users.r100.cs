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
    public partial class UsersBusinessRules : StefanTutorialDemo.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view for an action
        /// with a command name that matches "Insert|Update".
        /// </summary>
        [Rule("r100")]
        public void r100Implementation(UsersModel user)
        {
            if (user[UsersDataField.Password].Modified)
            {
                if (user.Password != user.PasswordConfirm)
                {
                    throw new Exception("Password and confirmation does not match.");
                }

                ApplicationMembershipProviderBase.ValidateUserPassword(user.UserName, user.Password);

                user.Password = ApplicationMembershipProviderBase.EncodeUserPassword(user.Password);
            }
        }
    }
}
