from django.core.management.base import BaseCommand
from django.contrib.auth.models import User

from fairhire.core.models import UserProfile


class Command(BaseCommand):
    help = "Create a default superuser if none exists"

    def handle(self, *args, **options):
        if not User.objects.filter(is_superuser=True).exists():
            user = User.objects.create_superuser(
                username="admin",
                email="admin@fairhire.local",
                password="admin",
            )
            UserProfile.objects.create(
                user=user,
                role=UserProfile.Role.ADMIN,
            )
            self.stdout.write(self.style.SUCCESS("Created default superuser: admin/admin"))
        else:
            # Ensure existing superusers have profiles
            for user in User.objects.filter(is_superuser=True):
                if not hasattr(user, "profile"):
                    UserProfile.objects.create(
                        user=user,
                        role=UserProfile.Role.ADMIN,
                    )
                    self.stdout.write(self.style.SUCCESS(f"Created admin profile for {user.username}"))
            self.stdout.write("Superuser already exists.")
