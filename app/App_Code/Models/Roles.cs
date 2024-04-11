using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using StefanTutorialDemo.Data;

namespace StefanTutorialDemo.Models
{
    public enum RolesDataField
    {

        RoleID,

        RoleName,
    }

    public partial class RolesModel : BusinessRulesObjectModel
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int? _roleID;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _roleName;

        public RolesModel()
        {
        }

        public RolesModel(BusinessRules r) :
                base(r)
        {
        }

        public int? RoleID
        {
            get
            {
                return _roleID;
            }
            set
            {
                _roleID = value;
                UpdateFieldValue("RoleID", value);
            }
        }

        public string RoleName
        {
            get
            {
                return _roleName;
            }
            set
            {
                _roleName = value;
                UpdateFieldValue("RoleName", value);
            }
        }

        public FieldValue this[RolesDataField field]
        {
            get
            {
                return this[field.ToString()];
            }
        }
    }
}
