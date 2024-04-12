namespace StefanTutorialDemo.Handlers
{


    public partial class BlobFactoryConfig : BlobFactory
    {

        public static void Initialize()
        {
            // register blob handlers
            RegisterHandler("AttachmentBlobHandler", "\"dbo\".\"Attachments\"", "\"Attachment\"", new string[] {
                        "\"AttachmentID\""}, "Attachments Attachment", "Attachments", "Attachment");
            RegisterHandler("ReceiptsPicture", "\"dbo\".\"Receipts\"", "\"Picture\"", new string[] {
                        "\"ReceiptID\""}, "Receipts Picture", "Receipts", "Picture");
        }
    }
}
