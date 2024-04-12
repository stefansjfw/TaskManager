using System;
using System.Data;
using System.Collections.Generic;
using System.Linq;
using StefanTutorialDemo.Data;

namespace StefanTutorialDemo.Rules
{
    public partial class SharedBusinessRules : StefanTutorialDemo.Data.BusinessRules
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

        protected override void EnumerateDynamicAccessControlRules(string controllerName)
        {
            base.EnumerateDynamicAccessControlRules(controllerName);

            if (!UserIsInRole("Administrators"))
            {
                RegisterAccessControlRule("OrganizationID", AccessPermission.Allow, OrganizationID);
                RegisterAccessControlRule("RoleID", AccessPermission.Deny, 1);
            }
        }



        // Called every time the controler is used as part of the request
        protected override void VirtualizeController(string controllerName)
        {
            base.VirtualizeController(controllerName);

            if (controllerName == "Users")
            {
                if (UserIsInRole("Administrators"))
                {
                    NodeSet().SelectActionGroup("ag1").CreateAction("Custom", "Impersonate")
                        .SetHeaderText("Impersonate").Attr("cssClass", "material-icon-group-add");
                }
                else
                {
                    NodeSet().SelectViews("grid1", "createForm1", "editForm1").SelectDataField("OrganizationID").Hide();
                }
            }
        }

        // Handles the press of the button. Linked to the action of the controler using the controler action attribute.
        [ControllerAction("Users", "Custom", "Impersonate")]
        public void HandleImpersonate()
        {
            var userToImpersonate = (string)SelectFieldValue("UserName");
            if (!string.IsNullOrEmpty(userToImpersonate) && !userToImpersonate.Equals("admin", StringComparison.InvariantCulture)
                && UserIsInRole("Administrators"))
            {
                var password = StringEncryptor.ToBase64String(DateTime.Now);

                // .js to trigger login in browser
                Result.ExecuteOnClient(@"
$app.login('" + userToImpersonate + @"', 'impersonate:" + password + @"', false, function() {
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
    }
}
