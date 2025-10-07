import FileUpload from '../FileUpload';

export default function FileUploadExample() {
  return (
    <div className="p-6">
      <FileUpload onFileUpload={(file) => console.log('File uploaded:', file.name)} />
    </div>
  );
}
