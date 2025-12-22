from scripts.email.send_email import send_email, load_template, render_template

template = load_template('holiday')
html = render_template(template, {'first_name': 'Greg'})

result = send_email(
    to_email='heygregwood@gmail.com',
    subject='Thanks for a great year',
    html_body=html,
    from_name='Greg Wood',
    from_email='greg@woodhouseagency.com'
)

print(result)
