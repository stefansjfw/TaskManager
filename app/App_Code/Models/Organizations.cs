using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using MyCompany.Data;

namespace MyCompany.Models
{
    public enum OrganizationsDataField
    {

        OrganizationID,

        Name,

        OwnerEmail,

        OwnerPassword,

        OwnerPasswordConfirmation,
    }

    public partial class OrganizationsModel : BusinessRulesObjectModel
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int? _organizationID;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _name;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _ownerEmail;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _ownerPassword;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _ownerPasswordConfirmation;

        public OrganizationsModel()
        {
        }

        public OrganizationsModel(BusinessRules r) :
                base(r)
        {
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

        public string Name
        {
            get
            {
                return _name;
            }
            set
            {
                _name = value;
                UpdateFieldValue("Name", value);
            }
        }

        public string OwnerEmail
        {
            get
            {
                return _ownerEmail;
            }
            set
            {
                _ownerEmail = value;
                UpdateFieldValue("OwnerEmail", value);
            }
        }

        public string OwnerPassword
        {
            get
            {
                return _ownerPassword;
            }
            set
            {
                _ownerPassword = value;
                UpdateFieldValue("OwnerPassword", value);
            }
        }

        public string OwnerPasswordConfirmation
        {
            get
            {
                return _ownerPasswordConfirmation;
            }
            set
            {
                _ownerPasswordConfirmation = value;
                UpdateFieldValue("OwnerPasswordConfirmation", value);
            }
        }

        public FieldValue this[OrganizationsDataField field]
        {
            get
            {
                return this[field.ToString()];
            }
        }
    }
}
