"""Django signals for the core hiring pipeline.

Auto-creates interview rounds when a candidate reaches the SHORTLISTED stage,
regardless of how the stage change occurred (API, admin, pipeline, etc.).
"""

import logging

logger = logging.getLogger("fairhire.core")


def on_candidate_pre_save(sender, instance, **kwargs):
    """Detect when a candidate is transitioning to shortlisted.

    Sets a flag on the instance so post_save can create interviews
    after the candidate record is fully persisted.
    """
    from fairhire.core.models import Candidate

    instance._needs_interview_setup = False

    if not instance.pk:
        return  # New candidate, not a stage change

    if instance.stage == Candidate.Stage.SHORTLISTED:
        try:
            old = Candidate.objects.only("stage").get(pk=instance.pk)
            if old.stage != Candidate.Stage.SHORTLISTED:
                instance._needs_interview_setup = True
        except Candidate.DoesNotExist:
            pass


def on_candidate_post_save(sender, instance, **kwargs):
    """After save, create interviews if candidate was just shortlisted."""
    if getattr(instance, "_needs_interview_setup", False):
        instance._needs_interview_setup = False
        # Only create if no interviews exist yet
        if not instance.interviews.exists():
            from fairhire.core.services import auto_setup_interviews
            logger.info(
                f"Signal: auto-creating interviews for newly shortlisted "
                f"candidate {instance.id}"
            )
            auto_setup_interviews(instance)


def connect_signals():
    """Connect pre_save and post_save signals. Called from AppConfig.ready()."""
    from django.db.models.signals import pre_save, post_save
    from fairhire.core.models import Candidate

    pre_save.connect(on_candidate_pre_save, sender=Candidate)
    post_save.connect(on_candidate_post_save, sender=Candidate)
