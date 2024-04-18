using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using MyCompany.Data;

namespace MyCompany.Rules
{
    public partial class SharedBusinessRules : MyCompany.Data.BusinessRules
    {

        public SharedBusinessRules()
        {
        }

        public int OrganizationID
        {
            get
            {
                object result = SqlText.ExecuteScalar("SELECT OrganizationID FROM Users WHERE UserID = @p0", UserId);
                return result is DBNull ? -1 : (int)result;
            }
        }

        protected override void VirtualizeController(string controllerName)
        {
            base.VirtualizeController(controllerName);
            if (controllerName == "Users" && UserIsInRole("Administrators"))
            {
                NodeSet().SelectActionGroup("ag1").CreateAction("Custom", "Impersonate")
                    .SetHeaderText("Impersonate").Attr("cssClass", "material-icon-group-add");
            }

            if (!UserIsInRole("Administrators"))
            {
                if (controllerName == "Users" || controllerName == "Receipts")
                {
                    NodeSet().SelectViews("grid1", "createForm1", "editForm1").SelectDataField("OrganizationID").Hide();
                }
            }
        }

        [ControllerAction("Users", "Custom", "Impersonate")]
        public void HandleImpersonate()
        {
            var userToImpersonate = (string)SelectFieldValue("UserName");
            if (!string.IsNullOrEmpty(userToImpersonate)
                && !userToImpersonate.Equals("admin", StringComparison.InvariantCulture)
                & UserIsInRole("Administrators"))
            {
                var password = StringEncryptor.ToBase64String(DateTime.Now);
                Result.ExecuteOnClient(@"
$app.login('" + userToImpersonate + @"', 'impersonate:" + password + @"', false, function () {
    setTimeout(function () {
        $app._navigated = true;
        window.location.replace($app.touch.returnUrl() || __baseUrl);
    });
});");
            }
        }

        public override bool SupportsVirtualization(string controllerName)
        {
            if (controllerName == "Users")
                return true;
            return base.SupportsVirtualization(controllerName);
        }

        protected override void EnumerateDynamicAccessControlRules(string controllerName)
        {
            base.EnumerateDynamicAccessControlRules(controllerName);
            if (!UserIsInRole("Administrators"))
            {
                if (UserIsInRole("Owners"))
                {
                    RegisterAccessControlRule("OrganizationID", AccessPermission.Allow, OrganizationID);
                }
                else
                {
                    RegisterAccessControlRule("UserID", AccessPermission.Allow, UserId);
                }

                RegisterAccessControlRule("RoleID", AccessPermission.Deny, 1);
                if (!UserIsInRole("Owners"))
                {
                    RegisterAccessControlRule("CreatedBy", AccessPermission.Allow, UserId);
                }
            }
        }
    }
}
