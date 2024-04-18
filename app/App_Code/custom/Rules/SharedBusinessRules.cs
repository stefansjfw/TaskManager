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

        protected override void VirtualizeController(string controllerName)
        {
            base.VirtualizeController(controllerName);
            if (controllerName == "Users" && UserIsInRole("Administrators"))
            {
                NodeSet().SelectActionGroup("ag1").CreateAction("Custom", "Impersonate")
                    .SetHeaderText("Impersonate").Attr("cssClass", "material-icon-group-add");
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
    }
}
