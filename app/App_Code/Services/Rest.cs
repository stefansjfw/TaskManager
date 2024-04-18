using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using System.Web;
using System.Web.Security;
using Newtonsoft.Json.Linq;

namespace MyCompany.Services.Rest
{
    public class RESTfulResourceException : Exception
    {

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private string _error;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private int _httpCode;

        [System.Diagnostics.DebuggerBrowsable(System.Diagnostics.DebuggerBrowsableState.Never)]
        private bool _schemaHint;

        private List<RESTfulResourceException> _related;

        public RESTfulResourceException(string error, string description) :
                this(-1, false, error, description)
        {
        }

        public RESTfulResourceException(int httpCode, string error, string description) :
                this(httpCode, false, error, description)
        {
        }

        public RESTfulResourceException(int httpCode, bool schemaHint, string error, string description) :
                base(description)
        {
            this.HttpCode = httpCode;
            this.SchemaHint = schemaHint;
            this.Error = error;
            _related = new List<RESTfulResourceException>();
        }

        public RESTfulResourceException(List<RESTfulResourceException> errors) :
                this(errors[0].HttpCode, errors[0].SchemaHint, errors[0].Error, errors[0].Message)
        {
            for (var i = 1; (i < errors.Count); i++)
                _related.Add(errors[i]);
        }

        public string Error
        {
            get
            {
                return _error;
            }
            set
            {
                _error = value;
            }
        }

        public int HttpCode
        {
            get
            {
                return _httpCode;
            }
            set
            {
                _httpCode = value;
            }
        }

        public bool SchemaHint
        {
            get
            {
                return _schemaHint;
            }
            set
            {
                _schemaHint = value;
            }
        }

        public List<RESTfulResourceException> Related
        {
            get
            {
                return _related;
            }
        }
    }
}
