from django.apps import AppConfig


class CoreConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "fairhire.core"
    label = "core"

    def ready(self):
        from fairhire.core.signals import connect_signals
        connect_signals()
