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
    public partial class RolesBusinessRules : StefanTutorialDemo.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view before an action
        /// with a command name that matches "Select".
        /// </summary>
        [Rule("r100")]
        public void r100Implementation(RolesModel instance)
        {
            if (!UserIsInRole("Administrators"))
            {
                throw new Exception("Not allowed.");
            }
        }
    }
}
