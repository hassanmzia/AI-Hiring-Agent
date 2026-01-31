"""Management command to run the A2A server standalone."""
import uvicorn
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = "Run the A2A (Agent-to-Agent) protocol server"

    def add_arguments(self, parser):
        parser.add_argument("--host", default="0.0.0.0")
        parser.add_argument("--port", type=int, default=8200)

    def handle(self, *args, **options):
        self.stdout.write(f"Starting A2A server on {options['host']}:{options['port']}")
        uvicorn.run(
            "fairhire.wsgi:application",
            host=options["host"],
            port=options["port"],
            log_level="info",
        )
