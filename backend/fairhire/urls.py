from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/", include("fairhire.api.urls")),
    path("", include("fairhire.mcp.urls")),
    path("", include("fairhire.a2a.urls")),
    path("api/responsible-ai/", include("fairhire.responsible_ai.urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
