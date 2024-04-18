using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using MyCompany.Data;
using MyCompany.Models;

namespace MyCompany.Rules
{
    public partial class TasksBusinessRules : MyCompany.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view before an action
        /// with a command name that matches "Delete".
        /// </summary>
        [Rule("r101")]
        public void r101Implementation(TasksModel instance)
        {
            if (instance.ScheduleID.HasValue)
            {
                PreventDefault();
                Result.Continue();
                SqlText.ExecuteNonQuery("DELETE Tasks " +
                    "WHERE ScheduleID = @p0 AND Date >= @p1",
                    instance.ScheduleID, instance.Date);
            }
        }
    }
}
