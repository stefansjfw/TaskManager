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
        /// with a command name that matches "Insert".
        /// </summary>
        [Rule("r101")]
        public void r101Implementation(TasksModel instance)
        {
            if (!string.IsNullOrEmpty(instance.ScheduleDaysOfWeek) && instance.ScheduleWeeks.HasValue && instance.ScheduleWeeks > 0)
            {
                PreventDefault();
                Schedules schedules = new Schedules
                {
                    DaysOfWeek = instance.ScheduleDaysOfWeek,
                    Weeks = instance.ScheduleWeeks
                };
                schedules.Insert();
                CreateScheduledMeetings(schedules, instance);
            }
        }

        void CreateScheduledMeetings(Schedules schedule, TasksModel template)
        {
            string[] daysOfWeek = schedule.DaysOfWeek.Split(',');
            DateTime startOfWeek = template.Date.Value;
            startOfWeek = startOfWeek.AddDays(-(int)startOfWeek.DayOfWeek);
            TimeSpan duration = template.EndDate.Value - template.Date.Value;

            for (int i = 0; i < schedule.Weeks.Value; i++)
            {
                foreach (string dayOfWeek in daysOfWeek)
                {
                    DayOfWeek dow = (DayOfWeek)Enum.Parse(typeof(DayOfWeek), dayOfWeek);
                    DateTime date = startOfWeek.AddDays((int)dow);

                    if (date >= template.Date)
                    {
                        Tasks t = new Tasks
                        {
                            Description = template.Description,
                            Address = template.Address,
                            City = template.City,
                            Country = template.Country,
                            Creator = template.Creator,
                            Tags = template.Tags,
                            State = template.State,
                            Date = date,
                            EndDate = date + duration,
                            LocationID = template.LocationID,
                            LocationName = template.LocationName,
                            PostalCode = template.PostalCode,
                            Owner = template.Owner,
                            ScheduleID = schedule.ScheduleID,
                            Created = template.Created,
                        };
                        t.Insert();
                    }
                }
                startOfWeek = startOfWeek.AddDays(7);
            }
        }
    }
}
