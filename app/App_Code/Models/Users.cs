using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using StefanTutorialDemo.Data;

namespace StefanTutorialDemo.Models
{
    public enum UsersDataField
    {

        UserID,

        UserName,

        Password,

        Email,

        OrganizationName,

        OrganizationID,

        Comment,

        EulaAcceptedOn,

        Roles,

        PasswordConfirm,
    }

    public partial class UsersModel : BusinessRulesObjectModel
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int? _userID;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _userName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _password;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _email;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _organizationName;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int? _organizationID;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _comment;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private DateTime? _eulaAcceptedOn;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _roles;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _passwordConfirm;

        public UsersModel()
        {
        }

        public UsersModel(BusinessRules r) :
                base(r)
        {
        }

        public int? UserID
        {
            get
            {
                return _userID;
            }
            set
            {
                _userID = value;
                UpdateFieldValue("UserID", value);
            }
        }

        public string UserName
        {
            get
            {
                return _userName;
            }
            set
            {
                _userName = value;
                UpdateFieldValue("UserName", value);
            }
        }

        public string Password
        {
            get
            {
                return _password;
            }
            set
            {
                _password = value;
                UpdateFieldValue("Password", value);
            }
        }

        public string Email
        {
            get
            {
                return _email;
            }
            set
            {
                _email = value;
                UpdateFieldValue("Email", value);
            }
        }

        public string OrganizationName
        {
            get
            {
                return _organizationName;
            }
            set
            {
                _organizationName = value;
                UpdateFieldValue("OrganizationName", value);
            }
        }

        public int? OrganizationID
        {
            get
            {
                return _organizationID;
            }
            set
            {
                _organizationID = value;
                UpdateFieldValue("OrganizationID", value);
            }
        }

        public string Comment
        {
            get
            {
                return _comment;
            }
            set
            {
                _comment = value;
                UpdateFieldValue("Comment", value);
            }
        }

        public DateTime? EulaAcceptedOn
        {
            get
            {
                return _eulaAcceptedOn;
            }
            set
            {
                _eulaAcceptedOn = value;
                UpdateFieldValue("EulaAcceptedOn", value);
            }
        }

        public string Roles
        {
            get
            {
                return _roles;
            }
            set
            {
                _roles = value;
                UpdateFieldValue("Roles", value);
            }
        }

        public string PasswordConfirm
        {
            get
            {
                return _passwordConfirm;
            }
            set
            {
                _passwordConfirm = value;
                UpdateFieldValue("PasswordConfirm", value);
            }
        }

        public FieldValue this[UsersDataField field]
        {
            get
            {
                return this[field.ToString()];
            }
        }
    }
}
