using System;
using System.Configuration;
using System.Configuration.Provider;
using System.Collections.Generic;
using System.Collections.Specialized;
using System.Data;
using System.Data.Common;
using System.Diagnostics;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using System.Text.RegularExpressions;
using System.Xml.XPath;
using System.Web;
using System.Web.Configuration;
using System.Web.Security;
using StefanTutorialDemo.Data;
using StefanTutorialDemo.Services;

namespace StefanTutorialDemo.Security
{
    public partial class ApplicationMembershipProvider : ApplicationMembershipProviderBase
    {
    }

    public enum MembershipProviderSqlStatement
    {

        ChangePassword,

        ChangePasswordQuestionAndAnswer,

        CreateUser,

        DeleteUser,

        CountAllUsers,

        GetAllUsers,

        GetNumberOfUsersOnline,

        GetPassword,

        GetUser,

        UpdateLastUserActivity,

        GetUserByProviderKey,

        UpdateUserLockStatus,

        GetUserNameByEmail,

        ResetPassword,

        UpdateUser,

        UpdateLastLoginDate,

        UpdateFailedPasswordAttempt,

        UpdateFailedPasswordAnswerAttempt,

        LockUser,

        CountUsersByName,

        FindUsersByName,

        CountUsersByEmail,

        FindUsersByEmail,
    }

    public class ApplicationMembershipProviderBase : MembershipProvider
    {

        protected static SortedDictionary<MembershipProviderSqlStatement, string> Statements = new SortedDictionary<MembershipProviderSqlStatement, string>();

        private int _newPasswordLength = 8;

        private ConnectionStringSettings _connectionStringSettings;

        private bool _writeExceptionsToEventLog;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _applicationName;

        private bool _enablePasswordReset;

        private bool _enablePasswordRetrieval;

        private bool _requiresQuestionAndAnswer;

        private bool _requiresUniqueEmail;

        private int _maxInvalidPasswordAttempts;

        private int _passwordAttemptWindow;

        private MembershipPasswordFormat _passwordFormat;

        private int _minRequiredNonAlphanumericCharacters;

        private int _minRequiredPasswordLength;

        private string _passwordStrengthRegularExpression;

        static ApplicationMembershipProviderBase()
        {
            Statements[MembershipProviderSqlStatement.ChangePassword] = "update Users set Password = @Password where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.ChangePasswordQuestionAndAnswer] = "update Users set Column_users_passwordquestion_IsNotMapped = @PasswordQuestion, Column_users_passwordanswer_IsNotMapped = @PasswordAnswer where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.CreateUser] = "\r\ninsert into Users\r\n(\r\n   UserName\r\n  ,Password\r\n  ,Email\r\n)\r\nvalues(\r\n   @UserName\r\n  ,@Password\r\n  ,@Email\r\n)";
            Statements[MembershipProviderSqlStatement.DeleteUser] = "delete from Users where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.CountAllUsers] = "select count(*) from Users";
            Statements[MembershipProviderSqlStatement.GetAllUsers] = "\r\nselect \r\n   UserID UserID\r\n  ,UserName UserName\r\n  ,Email Email\r\nfrom Users \r\norder by UserName asc";
            Statements[MembershipProviderSqlStatement.GetNumberOfUsersOnline] = "select count(*) from Users where Column_users_lastactivitydate_IsNotMapped >= @CompareDate";
            Statements[MembershipProviderSqlStatement.GetPassword] = "select Password Password from Users where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.GetUser] = "\r\nselect \r\n   UserID UserID\r\n  ,UserName UserName\r\n  ,Email Email\r\nfrom Users \r\nwhere UserName = @UserName";
            Statements[MembershipProviderSqlStatement.UpdateLastUserActivity] = "update Users set Column_users_lastactivitydate_IsNotMapped = @LastActivityDate where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.GetUserByProviderKey] = "\r\nselect \r\n   UserID UserID\r\n  ,UserName Username\r\n  ,Email Email\r\nfrom Users \r\nwhere UserID = @UserID";
            Statements[MembershipProviderSqlStatement.UpdateUserLockStatus] = "update Users set Column_users_islockedout_IsNotMapped = @IsLockedOut where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.GetUserNameByEmail] = "select UserName Username from Users where Email = @Email";
            Statements[MembershipProviderSqlStatement.ResetPassword] = "update Users set Password = @Password where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.UpdateUser] = "update Users set Email = @Email where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.UpdateLastLoginDate] = "update Users set Column_users_lastlogindate_IsNotMapped = @LastLoginDate where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.UpdateFailedPasswordAttempt] = "update Users set  where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.UpdateFailedPasswordAnswerAttempt] = "update Users set  where UserName = @UserName";
            Statements[MembershipProviderSqlStatement.CountUsersByName] = "select count(*) from Users where UserName like @UserName";
            Statements[MembershipProviderSqlStatement.FindUsersByName] = "\r\nselect \r\n   UserID UserID\r\n  ,UserName Username\r\n  ,Email Email\r\nfrom Users \r\nwhere UserName like @UserName\r\norder by UserName asc";
            Statements[MembershipProviderSqlStatement.CountUsersByEmail] = "select count(*) from Users where Email like @Email";
            Statements[MembershipProviderSqlStatement.FindUsersByEmail] = "\r\nselect \r\n   UserID UserID\r\n  ,UserName Username\r\n  ,Email Email\r\nfrom Users \r\nwhere Email like @Email\r\norder by UserName asc";
        }

        public virtual ConnectionStringSettings ConnectionStringSettings
        {
            get
            {
                return _connectionStringSettings;
            }
        }

        public bool WriteExceptionsToEventLog
        {
            get
            {
                return _writeExceptionsToEventLog;
            }
        }

        public override string ApplicationName
        {
            get
            {
                return _applicationName;
            }
            set
            {
                _applicationName = value;
            }
        }

        public override bool EnablePasswordReset
        {
            get
            {
                return _enablePasswordReset;
            }
        }

        public override bool EnablePasswordRetrieval
        {
            get
            {
                return _enablePasswordRetrieval;
            }
        }

        public override bool RequiresQuestionAndAnswer
        {
            get
            {
                return _requiresQuestionAndAnswer;
            }
        }

        public override bool RequiresUniqueEmail
        {
            get
            {
                return _requiresUniqueEmail;
            }
        }

        public override int MaxInvalidPasswordAttempts
        {
            get
            {
                return _maxInvalidPasswordAttempts;
            }
        }

        public override int PasswordAttemptWindow
        {
            get
            {
                return _passwordAttemptWindow;
            }
        }

        public override MembershipPasswordFormat PasswordFormat
        {
            get
            {
                return _passwordFormat;
            }
        }

        public override int MinRequiredNonAlphanumericCharacters
        {
            get
            {
                return _minRequiredNonAlphanumericCharacters;
            }
        }

        public override int MinRequiredPasswordLength
        {
            get
            {
                return _minRequiredPasswordLength;
            }
        }

        public override string PasswordStrengthRegularExpression
        {
            get
            {
                return _passwordStrengthRegularExpression;
            }
        }

        public virtual MembershipPasswordFormat DefaultPasswordFormat
        {
            get
            {
                return MembershipPasswordFormat.Hashed;
            }
        }

        protected virtual SqlStatement CreateSqlStatement(MembershipProviderSqlStatement command)
        {
            var sql = new SqlText(Statements[command], ConnectionStringSettings.Name);
            sql.Command.CommandText = sql.Command.CommandText.Replace("@", sql.ParameterMarker);
            if (sql.Command.CommandText.Contains((sql.ParameterMarker + "ApplicationName")))
                sql.AssignParameter("ApplicationName", ApplicationName);
            sql.Name = ("StefanTutorialDemo Application Membership Provider - " + command.ToString());
            sql.WriteExceptionsToEventLog = WriteExceptionsToEventLog;
            return sql;
        }

        private string GetConfigValue(string configValue, string defaultValue)
        {
            if (string.IsNullOrEmpty(configValue))
                return defaultValue;
            return configValue;
        }

        public override void Initialize(string name, NameValueCollection config)
        {
            if (config == null)
                throw new ArgumentNullException("config");
            if (string.IsNullOrEmpty(name))
                name = "StefanTutorialDemoApplicationMembershipProvider";
            if (string.IsNullOrEmpty(config["description"]))
            {
                config.Remove("description");
                config.Add("description", "StefanTutorialDemo application membership provider");
            }
            base.Initialize(name, config);
            _applicationName = config["applicationName"];
            if (string.IsNullOrEmpty(_applicationName))
                _applicationName = System.Web.Hosting.HostingEnvironment.ApplicationVirtualPath;
            _maxInvalidPasswordAttempts = Convert.ToInt32(GetConfigValue(config["maxInvalidPasswordAttempts"], "5"));
            _passwordAttemptWindow = Convert.ToInt32(GetConfigValue(config["passwordAttemptWindow"], "10"));
            _minRequiredNonAlphanumericCharacters = Convert.ToInt32(GetConfigValue(config["minRequiredNonAlphanumericCharacters"], "1"));
            _minRequiredPasswordLength = Convert.ToInt32(GetConfigValue(config["minRequiredPasswordLength"], "7"));
            _passwordStrengthRegularExpression = Convert.ToString(GetConfigValue(config["passwordStrengthRegularExpression"], string.Empty));
            _enablePasswordReset = Convert.ToBoolean(GetConfigValue(config["enablePasswordReset"], "true"));
            _enablePasswordRetrieval = Convert.ToBoolean(GetConfigValue(config["enablePasswordRetrieval"], "true"));
            _requiresQuestionAndAnswer = Convert.ToBoolean(GetConfigValue(config["requiresQuestionAndAnswer"], "false"));
            _requiresUniqueEmail = Convert.ToBoolean(GetConfigValue(config["requiresUniqueEmail"], "true"));
            _writeExceptionsToEventLog = Convert.ToBoolean(GetConfigValue(config["writeExceptionsToEventLog"], "false"));
            var pwdFormat = config["passwordFormat"];
            if (string.IsNullOrEmpty(pwdFormat))
                pwdFormat = DefaultPasswordFormat.ToString();
            if (pwdFormat == "Hashed")
                _passwordFormat = MembershipPasswordFormat.Hashed;
            else
            {
                if (pwdFormat == "Encrypted")
                    _passwordFormat = MembershipPasswordFormat.Encrypted;
                else
                {
                    if (pwdFormat == "Clear")
                        _passwordFormat = MembershipPasswordFormat.Clear;
                    else
                        throw new ProviderException("Password format is not supported.");
                }
            }
            _connectionStringSettings = ConfigurationManager.ConnectionStrings[config["connectionStringName"]];
            if ((_connectionStringSettings == null) || string.IsNullOrEmpty(_connectionStringSettings.ConnectionString))
                throw new ProviderException("Connection string cannot be blank.");
        }

        public override bool ChangePassword(string username, string oldPwd, string newPwd)
        {
            if (!ValidateUser(username, oldPwd))
                return false;
            var args = new ValidatePasswordEventArgs(username, newPwd, false);
            OnValidatingPassword(args);
            if (args.Cancel)
            {
                if (args.FailureInformation != null)
                    throw args.FailureInformation;
                else
                    throw new MembershipPasswordException("Change of password canceled due to new password validation failure.");
            }
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.ChangePassword))
            {
                sql.AssignParameter("Password", EncodePassword(newPwd));
                sql.AssignParameter("UserName", username);
                return (sql.ExecuteNonQuery() == 1);
            }
        }

        public override bool ChangePasswordQuestionAndAnswer(string username, string password, string newPwdQuestion, string newPwdAnswer)
        {
            return false;
        }

        public static string EncodeUserPassword(string password)
        {
            return ((ApplicationMembershipProviderBase)(Membership.Provider)).EncodePassword(password);
        }

        public static void ValidateUserPassword(string username, string password)
        {
            ValidateUserPassword(username, password, true);
        }

        public static void ValidateUserPassword(string username, string password, bool isNewUser)
        {
            var args = new ValidatePasswordEventArgs(username, password, isNewUser);
            ((ApplicationMembershipProviderBase)(Membership.Provider)).OnValidatingPassword(args);
            if (args.Cancel)
            {
                if (args.FailureInformation != null)
                    throw args.FailureInformation;
            }
        }

        public override MembershipUser CreateUser(string username, string password, string email, string passwordQuestion, string passwordAnswer, bool isApproved, object providerUserKey, out MembershipCreateStatus status)
        {
            var args = new ValidatePasswordEventArgs(username, password, true);
            OnValidatingPassword(args);
            if (args.Cancel)
            {
                status = MembershipCreateStatus.InvalidPassword;
                return null;
            }
            if (RequiresUniqueEmail && !string.IsNullOrEmpty(GetUserNameByEmail(email)))
            {
                status = MembershipCreateStatus.DuplicateEmail;
                return null;
            }
            if (GetUser(username, false) != null)
                status = MembershipCreateStatus.DuplicateUserName;
            else
            {
                var creationDate = DateTime.Now;
                using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.CreateUser))
                {
                    sql.AssignParameter("UserName", username);
                    sql.AssignParameter("Password", EncodePassword(password));
                    sql.AssignParameter("Email", email);
                    if (sql.ExecuteNonQuery() > 0)
                    {
                        status = MembershipCreateStatus.Success;
                        return GetUser(username, false);
                    }
                    else
                        status = MembershipCreateStatus.UserRejected;
                }
            }
            return null;
        }

        public override bool DeleteUser(string username, bool deleteAllRelatedData)
        {
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.DeleteUser))
            {
                sql.AssignParameter("UserName", username);
                return (sql.ExecuteNonQuery() > 0);
            }
        }

        public override MembershipUserCollection GetAllUsers(int pageIndex, int pageSize, out int totalRecords)
        {
            totalRecords = 0;
            var users = new MembershipUserCollection();
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.CountAllUsers))
            {
                totalRecords = Convert.ToInt32(sql.ExecuteScalar());
                if (totalRecords <= 0)
                    return users;
            }
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetAllUsers))
            {
                var counter = 0;
                var startIndex = (pageSize * pageIndex);
                var endIndex = ((startIndex + pageSize) - 1);
                while (sql.Read())
                {
                    if (counter >= startIndex)
                        users.Add(GetUser(sql));
                    if (counter >= endIndex)
                        break;
                    counter++;
                }
            }
            return users;
        }

        public override int GetNumberOfUsersOnline()
        {
            return 0;
        }

        public override string GetPassword(string username, string answer)
        {
            if (!EnablePasswordRetrieval)
                throw new ProviderException("Password retrieval is not enabled.");
            if (PasswordFormat == MembershipPasswordFormat.Hashed)
                throw new ProviderException("Cannot retrieve hashed passwords.");
            var password = string.Empty;
            var passwordAnswer = string.Empty;
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetPassword))
            {
                sql.AssignParameter("UserName", username);
                if (sql.Read())
                    password = Convert.ToString(sql["Password"]);
                else
                    throw new MembershipPasswordException("User name is not found.");
            }
            if (PasswordFormat == MembershipPasswordFormat.Encrypted)
                password = DecodePassword(password);
            return password;
        }

        public override MembershipUser GetUser(string username, bool userIsOnline)
        {
            MembershipUser u = null;
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetUser))
            {
                sql.AssignParameter("UserName", username);
                if (sql.Read())
                    u = GetUser(sql);
            }
            return u;
        }

        public override MembershipUser GetUser(object providerUserKey, bool userIsOnline)
        {
            MembershipUser u = null;
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetUserByProviderKey))
            {
                sql.AssignParameter("UserID", providerUserKey);
                if (sql.Read())
                    u = GetUser(sql);
            }
            return u;
        }

        private MembershipUser GetUser(SqlStatement sql)
        {
            var providerUserKey = sql["UserID"];
            var username = Convert.ToString(sql["UserName"]);
            var email = Convert.ToString(sql["Email"]);
            var passwordQuestion = string.Empty;
            var comment = string.Empty;
            var isApproved = true;
            var isLockedOut = false;
            var creationDate = DateTime.MinValue;
            var lastLoginDate = DateTime.Now;
            var lastActivityDate = DateTime.MinValue;
            var lastPasswordChangedDate = DateTime.MinValue;
            var lastLockedOutDate = DateTime.MinValue;
            return new MembershipUser(this.Name, username, providerUserKey, email, passwordQuestion, comment, isApproved, isLockedOut, creationDate, lastLoginDate, lastActivityDate, lastPasswordChangedDate, lastLockedOutDate);
        }

        public override bool UnlockUser(string username)
        {
            return false;
        }

        public override string GetUserNameByEmail(string email)
        {
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetUserNameByEmail))
            {
                sql.AssignParameter("Email", email);
                return Convert.ToString(sql.ExecuteScalar());
            }
        }

        public override string ResetPassword(string username, string answer)
        {
            if (!EnablePasswordReset)
                throw new NotSupportedException("Password reset is not enabled.");
            var newPassword = Membership.GeneratePassword(this._newPasswordLength, MinRequiredNonAlphanumericCharacters);
            var args = new ValidatePasswordEventArgs(username, newPassword, false);
            OnValidatingPassword(args);
            if (args.Cancel)
            {
                if (args.FailureInformation != null)
                    throw args.FailureInformation;
                else
                    throw new MembershipPasswordException("Reset password canceled due to password validation failure.");
            }
            var passwordAnswer = string.Empty;
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetPassword))
            {
                sql.AssignParameter("UserName", username);
                if (sql.Read())
                {
                }
                else
                    throw new MembershipPasswordException("User is not found.");
            }
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.ResetPassword))
            {
                sql.AssignParameter("Password", EncodePassword(newPassword));
                sql.AssignParameter("UserName", username);
                if (sql.ExecuteNonQuery() > 0)
                    return newPassword;
                else
                    throw new MembershipPasswordException("User is not found or locked out. Password has not been reset.");
            }
        }

        public override void UpdateUser(MembershipUser user)
        {
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.UpdateUser))
            {
                sql.AssignParameter("Email", user.Email);
                sql.AssignParameter("UserName", user.UserName);
                sql.ExecuteNonQuery();
            }
        }

        public override bool ValidateUser(string username, string password)
        {
            var isValid = false;
            string pwd = null;
            var isApproved = true;
            username = username.Trim();
            password = password.Trim();
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetPassword))
            {
                sql.AssignParameter("UserName", username);
                if (sql.Read())
                    pwd = Convert.ToString(sql["Password"]);
                else
                    return false;
            }
            if (CheckPassword(password, pwd))
            {
                if (isApproved)
                    isValid = true;
            }
            else
                UpdateFailureCount(username, "Password");
            return isValid;
        }

        private void UpdateFailureCount(string username, string failureType)
        {
            var failureCount = 0;
            var windowStart = DateTime.Now;
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.GetUser))
            {
                sql.AssignParameter("UserName", username);
                if (!sql.Read())
                    return;
                if (failureType == "Password")
                {
                }
                if (failureType == "PasswordAnswer")
                {
                }
            }
            var windowEnd = windowStart.AddMinutes(PasswordAttemptWindow);
            if ((failureCount == 0) || (DateTime.Now > windowEnd))
            {
            }
            else
            {
                failureCount++;
                if (failureCount > MaxInvalidPasswordAttempts)
                {
                }
            }
        }

        private bool CheckPassword(string password, string currentPassword)
        {
            var pass1 = password;
            var pass2 = currentPassword;
            if (PasswordFormat == MembershipPasswordFormat.Encrypted)
                pass2 = DecodePassword(currentPassword);
            else
            {
                if (PasswordFormat == MembershipPasswordFormat.Hashed)
                    pass1 = EncodePassword(password);
            }
            return (pass1 == pass2);
        }

        public virtual string EncodePassword(string password)
        {
            if (string.IsNullOrEmpty(password))
                return password;
            var encodedPassword = password;
            if (PasswordFormat == MembershipPasswordFormat.Encrypted)
                encodedPassword = Convert.ToBase64String(EncryptPassword(Encoding.Unicode.GetBytes(password)));
            else
            {
                if (PasswordFormat == MembershipPasswordFormat.Hashed)
                {
                    var hash = new HMACSHA1()
                    {
                        Key = HexToByte(ApplicationServices.ValidationKey)
                    };
                    encodedPassword = Convert.ToBase64String(hash.ComputeHash(Encoding.Unicode.GetBytes(password)));
                }
            }
            return encodedPassword;
        }

        public virtual string DecodePassword(string encodedPassword)
        {
            var password = encodedPassword;
            if (PasswordFormat == MembershipPasswordFormat.Encrypted)
                password = Encoding.Unicode.GetString(DecryptPassword(Convert.FromBase64String(encodedPassword)));
            else
            {
                if (PasswordFormat == MembershipPasswordFormat.Hashed)
                    throw new ProviderException("Cannot decode a hashed password.");
            }
            return password;
        }

        public static byte[] HexToByte(string hexString)
        {
            var returnBytes = new byte[(hexString.Length / 2)];
            for (var i = 0; (i < returnBytes.Length); i++)
                returnBytes[i] = Convert.ToByte(hexString.Substring((i * 2), 2), 16);
            return returnBytes;
        }

        public override MembershipUserCollection FindUsersByName(string usernameToMatch, int pageIndex, int pageSize, out int totalRecords)
        {
            var users = new MembershipUserCollection();
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.CountUsersByName))
            {
                sql.AssignParameter("UserName", usernameToMatch);
                totalRecords = Convert.ToInt32(sql.ExecuteScalar());
            }
            if (totalRecords > 0)
            {
                var counter = 0;
                var startIndex = (pageSize * pageIndex);
                var endIndex = ((startIndex + pageSize) - 1);
                using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.FindUsersByName))
                {
                    sql.AssignParameter("UserName", usernameToMatch);
                    while (sql.Read())
                    {
                        if (counter >= startIndex)
                            users.Add(GetUser(sql));
                        if (counter >= endIndex)
                            break;
                        counter++;
                    }
                }
            }
            return users;
        }

        public override MembershipUserCollection FindUsersByEmail(string emailToMatch, int pageIndex, int pageSize, out int totalRecords)
        {
            var users = new MembershipUserCollection();
            using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.CountUsersByEmail))
            {
                sql.AssignParameter("UserName", emailToMatch);
                totalRecords = Convert.ToInt32(sql.ExecuteScalar());
            }
            if (totalRecords > 0)
            {
                var counter = 0;
                var startIndex = (pageSize * pageIndex);
                var endIndex = ((startIndex + pageSize) - 1);
                using (var sql = CreateSqlStatement(MembershipProviderSqlStatement.FindUsersByEmail))
                {
                    sql.AssignParameter("Email", emailToMatch);
                    while (sql.Read())
                    {
                        if (counter >= startIndex)
                            users.Add(GetUser(sql));
                        if (counter >= endIndex)
                            break;
                        counter++;
                    }
                }
            }
            return users;
        }

        protected override void OnValidatingPassword(ValidatePasswordEventArgs e)
        {
            try
            {
                var password = e.Password;
                if (password.Length < MinRequiredPasswordLength)
                    throw new ArgumentException("Invalid password length.");
                var count = 0;
                for (var i = 0; (i < password.Length); i++)
                    if (!Char.IsLetterOrDigit(password, i))
                        count++;
                if (count < MinRequiredNonAlphanumericCharacters)
                    throw new ArgumentException("Password needs more non-alphanumeric characters.");
                if (!string.IsNullOrEmpty(PasswordStrengthRegularExpression))
                {
                    if (!Regex.IsMatch(password, PasswordStrengthRegularExpression))
                        throw new ArgumentException("Password does not match regular expression.");
                }
                base.OnValidatingPassword(e);
                if (e.Cancel)
                {
                    if (e.FailureInformation != null)
                        throw e.FailureInformation;
                    else
                        throw new ArgumentException("Custom password validation failure.");
                }
            }
            catch (Exception ex)
            {
                e.FailureInformation = ex;
                e.Cancel = true;
            }
        }
    }
}
