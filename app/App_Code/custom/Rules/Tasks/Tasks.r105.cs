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
    public partial class TasksBusinessRules : StefanTutorialDemo.Rules.SharedBusinessRules
    {

        /// <summary>This method will execute in any view before an action
        /// with a command name that matches "Delete".
        /// </summary>
        [Rule("r105")]
        public void r105Implementation(TasksModel instance)
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
