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

        // Called every time the controler is used as part of the request
        protected override void VirtualizeController(string controllerName)
        {
            base.VirtualizeController(controllerName);

            if (controllerName == "Users" && UserIsInRole("Administrators"))
            {
                NodeSet().SelectActionGroup("ag1").CreateAction("Custom", "Impersonate")
                    .SetHeaderText("Impersonate").Attr("cssClass", "material-icon-group-add");
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
