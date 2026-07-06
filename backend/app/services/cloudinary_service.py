import cloudinary
import cloudinary.uploader

from app.core.config import settings

cloudinary.config(
    cloud_name=settings.CLOUDINARY_CLOUD_NAME,
    api_key=settings.CLOUDINARY_API_KEY,
    api_secret=settings.CLOUDINARY_API_SECRET,
    secure=True,
)


def upload_image(file_bytes, folder="champion-circuit"):
    return cloudinary.uploader.upload(
        file_bytes,
        folder=folder,
        resource_type="image",
    )["secure_url"]