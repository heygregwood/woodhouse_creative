# Email module for Woodhouse Creative Automation
from .send_email import (
    send_welcome_email,
    send_first_post_scheduled_email,
    send_post_scheduled_email,
    send_content_ready_email,
    get_dealer,
    get_brand_info
)

__all__ = [
    'send_welcome_email',
    'send_first_post_scheduled_email', 
    'send_post_scheduled_email',
    'send_content_ready_email',
    'get_dealer',
    'get_brand_info'
]
