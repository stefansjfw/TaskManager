namespace StefanTutorialDemo.Handlers
{


    public partial class BlobFactoryConfig : BlobFactory
    {

        public static void Initialize()
        {
            // register blob handlers
            RegisterHandler("AttachmentBlobHandler", "\"dbo\".\"Attachments\"", "\"Attachment\"", new string[] {
                        "\"AttachmentID\""}, "Attachments Attachment", "Attachments", "Attachment");
        }
    }
}
