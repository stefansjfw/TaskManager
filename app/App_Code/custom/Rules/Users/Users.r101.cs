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
    public partial class UsersBusinessRules : StefanTutorialDemo.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view before an action
        /// with a command name that matches "Select".
        /// </summary>
        [Rule("r101")]
        public void r101Implementation(UsersModel instance)
        {
            if (!UserIsInRole("Administrators"))
            {
                // throw new Exception("Not allowed.");
            }
        }
    }
}
