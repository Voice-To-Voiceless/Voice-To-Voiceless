"""Add persistent calibration profiles."""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision = "0002_calibration_profile"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "calibration_profile",
        sa.Column("id", postgresql.UUID(as_uuid=True), server_default=sa.text("gen_random_uuid()"), nullable=False),
        sa.Column("patient_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("installation_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("setup_key", sa.String(length=64), nullable=False),
        sa.Column("engine", sa.String(length=30), nullable=False),
        sa.Column("engine_version", sa.String(length=40), nullable=False),
        sa.Column("payload_version", sa.Integer(), nullable=False),
        sa.Column("score_version", sa.Integer(), nullable=False),
        sa.Column("accuracy_score", sa.SmallInteger(), nullable=False),
        sa.Column("validation_rms", sa.Double(), nullable=False),
        sa.Column("validation_p95", sa.Double(), nullable=False),
        sa.Column("training_data", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("setup_metadata", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("pose_reference", postgresql.JSONB(astext_type=sa.Text()), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("last_verified_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_verification_score", sa.SmallInteger(), nullable=True),
        sa.ForeignKeyConstraint(["patient_id"], ["patient.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("patient_id", "installation_id", "setup_key", name="uq_calibration_profile_lookup"),
        sa.CheckConstraint("accuracy_score BETWEEN 55 AND 100", name="ck_calibration_profile_accuracy_score"),
        sa.CheckConstraint("last_verification_score IS NULL OR last_verification_score BETWEEN 0 AND 100", name="ck_calibration_profile_verification_score"),
        sa.CheckConstraint("payload_version > 0 AND score_version > 0", name="ck_calibration_profile_versions"),
        sa.CheckConstraint("validation_rms >= 0 AND validation_p95 >= 0", name="ck_calibration_profile_validation_errors"),
    )


def downgrade() -> None:
    op.drop_table("calibration_profile")
